import { NextResponse } from "next/server";
import { createClient } from "@sanity/client";

import prisma from "@/lib/prismaClient";

const sanityClient = createClient({
  projectId: "arbp7h2s",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

interface SyncStats {
  created: number;
  updated: number;
  errors: number;
  total: number;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST() {
  console.log('=== SYNC FROM SANITY START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const stats: SyncStats = {
      created: 0,
      updated: 0,
      errors: 0,
      total: 0,
    };
    const errorDetails: Array<{ orderId: string; error: string; context?: any }> = [];

    // Check Sanity token
    if (!process.env.SANITY_API_TOKEN) {
      console.error('SANITY_API_TOKEN is not set!');
      throw new Error('SANITY_API_TOKEN environment variable is not configured');
    }
    console.log('SANITY_API_TOKEN: configured (length:', process.env.SANITY_API_TOKEN.length, ')');

    // Fetch all orders from Sanity with all shipping fields
    const sanityOrders = await sanityClient.fetch(`
      *[_type == "order"] {
        _id,
        orderNumber,
        userId,
        customerEmail,
        customerName,
        total,
        status,
        items[] {
          _key,
          itemId,
          productId,
          variantId,
          name,
          quantity,
          price
        },
        shippingAddress,
        shippingFirstName,
        shippingLastName,
        shippingEmail,
        shippingPhone,
        shippingCity,
        shippingState,
        shippingZipCode,
        shippingCountry,
        stripePaymentIntentId,
        createdAt,
        updatedAt
      }
    `);

    stats.total = sanityOrders.length;

    // Process each Sanity order
    for (const sanityOrder of sanityOrders) {
      try {
        // Extract order ID from Sanity _id (format: "order-{uuid}")
        const orderId = sanityOrder._id.replace("order-", "");

        // Check if order exists in database
        const existingOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: { OrderItem: true }
        });

        // Validate and prepare order data
        const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
        const status = validStatuses.includes(sanityOrder.status as any) ? sanityOrder.status as typeof validStatuses[number] : 'PENDING';

        console.log(`Processing order ${orderId}: status from Sanity = "${sanityOrder.status}", validated status = "${status}"`);

        if (existingOrder) {
          // For EXISTING orders, only update status and basic fields
          // PRESERVE shipping data from Neon (source of truth for shipping info)
          console.log(`Updating existing order ${orderId}:`, {
            oldStatus: existingOrder.status,
            newStatus: status,
          });

          // Only update status - shipping fields are preserved from original order
          const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
              status: status,
              // DO NOT overwrite shipping fields - Neon is source of truth
              // Shipping data comes from payment flow, not Sanity
            }
          });

          console.log(`Order ${orderId} updated successfully. New status: ${updatedOrder.status}`);

          // Delete existing order items
          await prisma.orderItem.deleteMany({
            where: { orderId: orderId }
          });

          stats.updated++;
        } else {
          console.log(`Creating new order ${orderId} with status: ${status}`);

          // For NEW orders, map Sanity shipping fields to Neon flat structure
          // Parse customer name into first/last
          const customerNameParts = (sanityOrder.customerName || '').split(' ');
          const firstName = customerNameParts[0] || '';
          const lastName = customerNameParts.slice(1).join(' ') || '';

          // Map Sanity's nested shippingAddress to Neon's flat fields
          const shippingAddress = sanityOrder.shippingAddress || {};

          // Create new order from Sanity data with proper shipping mapping
          const newOrder = await prisma.order.create({
            data: {
              id: orderId,
              orderNumber: sanityOrder.orderNumber,
              userId: sanityOrder.userId,
              status: status,
              total: sanityOrder.total,
              stripePaymentIntentId: sanityOrder.stripePaymentIntentId,
              createdAt: new Date(sanityOrder.createdAt),
              // Map shipping fields from Sanity
              shippingFirstName: sanityOrder.shippingFirstName || shippingAddress.name?.split(' ')[0] || firstName,
              shippingLastName: sanityOrder.shippingLastName || shippingAddress.name?.split(' ').slice(1).join(' ') || lastName,
              shippingEmail: sanityOrder.shippingEmail || sanityOrder.customerEmail || '',
              shippingPhone: sanityOrder.shippingPhone || '',
              shippingAddress: shippingAddress.street || '',
              shippingCity: sanityOrder.shippingCity || shippingAddress.city || '',
              shippingState: sanityOrder.shippingState || shippingAddress.state || '',
              shippingZipCode: sanityOrder.shippingZipCode || shippingAddress.postalCode || '',
              shippingCountry: sanityOrder.shippingCountry || shippingAddress.country || '',
            }
          });

          console.log(`Order ${orderId} created successfully. Status: ${newOrder.status}`);

          stats.created++;
        }

        // Create order items
        if (sanityOrder.items && sanityOrder.items.length > 0) {
          for (const item of sanityOrder.items) {
            try {
              await prisma.orderItem.create({
                data: {
                  id: item.itemId,
                  orderId: orderId,
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  price: item.price,
                }
              });
            } catch (error) {
              console.error(`Error creating order item ${item.itemId}:`, error);
              stats.errors++;
            }
          }
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error syncing order ${sanityOrder._id}:`, errorMessage);
        errorDetails.push({
          orderId: sanityOrder._id,
          error: errorMessage,
          context: { orderNumber: sanityOrder.orderNumber, status: sanityOrder.status }
        });
        stats.errors++;
      }
    }

    console.log('=== SYNC FROM SANITY COMPLETE ===');
    console.log('Stats:', stats);
    if (errorDetails.length > 0) {
      console.log('Error details:', errorDetails);
    }

    // Update sync state in Sanity
    try {
      const syncState = {
        _type: "syncState",
        _id: "sanity-to-db-sync-state",
        key: "sanity-to-db",
        lastSyncTime: new Date().toISOString(),
        syncStatus: stats.errors > 0 ? "failed" : "success",
        syncStats: stats,
      };

      await sanityClient.createOrReplace(syncState);
    } catch (error) {
      console.error("Error updating sync state:", error);
    }

    return NextResponse.json(
      {
        success: stats.errors === 0,
        stats,
        message: `Sanity to DB sync completed. Created: ${stats.created}, Updated: ${stats.updated}, Errors: ${stats.errors}`,
        errorDetails: errorDetails.slice(0, 10), // Return first 10 errors for debugging
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Sync from Sanity failed:", error);

    return NextResponse.json(
      {
        success: false,
        stats: { created: 0, updated: 0, errors: 1, total: 0 },
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } finally {
    await prisma.$disconnect();
  }
}