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
  try {
    const stats: SyncStats = {
      created: 0,
      updated: 0,
      errors: 0,
      total: 0,
    };

    // Fetch all orders from Sanity
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
          include: { items: true }
        });

        // Validate and prepare order data
        const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
        const status = validStatuses.includes(sanityOrder.status as any) ? sanityOrder.status as typeof validStatuses[number] : 'PENDING';
        
        console.log(`Processing order ${orderId}: status from Sanity = "${sanityOrder.status}", validated status = "${status}"`);

        const orderData = {
          orderNumber: sanityOrder.orderNumber,
          userId: sanityOrder.userId,
          status: status,
          total: sanityOrder.total,
          stripePaymentIntentId: sanityOrder.stripePaymentIntentId,
          createdAt: new Date(sanityOrder.createdAt),
          // Note: updatedAt is automatically managed by Prisma
        };

        if (existingOrder) {
          console.log(`Updating existing order ${orderId}:`, {
            oldStatus: existingOrder.status,
            newStatus: status,
            orderData
          });
          
          // Update existing order
          const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: orderData
          });

          console.log(`Order ${orderId} updated successfully. New status: ${updatedOrder.status}`);

          // Delete existing order items
          await prisma.orderItem.deleteMany({
            where: { orderId: orderId }
          });

          stats.updated++;
        } else {
          console.log(`Creating new order ${orderId} with status: ${status}`);
          
          // Create new order from Sanity data
          const newOrder = await prisma.order.create({
            data: {
              id: orderId,
              ...orderData
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
        console.error(`Error syncing order ${sanityOrder._id}:`, error);
        stats.errors++;
      }
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
        success: true,
        stats,
        message: `Sanity to DB sync completed. Created: ${stats.created}, Updated: ${stats.updated}, Errors: ${stats.errors}`,
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