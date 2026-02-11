import { NextResponse } from "next/server";
import { createClient } from "@sanity/client";

import prisma from "@/lib/prismaClient";
import { mapNeonOrderToSanity } from "@/lib/mappers/orderMapper";

const sanityClient = createClient({
  projectId: "arbp7h2s",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN, // You'll need to add this to your .env
});

interface SyncStats {
  created: number;
  updated: number;
  deleted: number;
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
  console.log('=== SYNC ORDERS (DB → SANITY) START ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const stats: SyncStats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      total: 0,
    };
    const errorDetails: Array<{ orderNumber: string; error: string; context?: any }> = [];

    // Check Sanity token
    if (!process.env.SANITY_API_TOKEN) {
      console.error('SANITY_API_TOKEN is not set!');
      throw new Error('SANITY_API_TOKEN environment variable is not configured');
    }
    console.log('SANITY_API_TOKEN: configured (length:', process.env.SANITY_API_TOKEN.length, ')');

    // Fetch orders from Neon DB
    console.log('Fetching orders from database...');
    const orders = await prisma.order.findMany({
      include: {
        User: {
          select: {
            email: true,
            name: true,
          },
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                name: true,
              },
            },
            ProductVariant: {
              select: {
                sku: true,
                color: true,
                size: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    stats.total = orders.length;
    console.log(`Found ${orders.length} orders in database`);

    // Fetch existing order IDs from Sanity (batch query to avoid N+1)
    console.log('Fetching existing order IDs from Sanity...');
    const existingIds = new Set(
      await sanityClient.fetch<string[]>(
        `*[_type == "order"]._id`
      )
    );
    console.log(`Found ${existingIds.size} existing orders in Sanity`);

    // Sync each order to Sanity
    for (const order of orders) {
      try {
        const sanityOrder = mapNeonOrderToSanity(order);

        // Track whether this is a create or update based on pre-fetched IDs
        if (existingIds.has(sanityOrder._id)) {
          stats.updated++;
        } else {
          stats.created++;
        }

        // Upsert to Sanity (idempotent)
        await sanityClient.createOrReplace(sanityOrder);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error syncing order ${order.id} (${order.orderNumber}):`, errorMessage);
        errorDetails.push({
          orderNumber: order.orderNumber,
          error: errorMessage,
          context: { orderId: order.id, status: order.status, itemCount: order.OrderItem?.length || 0 }
        });
        stats.errors++;
      }
    }

    console.log('=== SYNC ORDERS COMPLETE ===');
    console.log('Stats:', stats);
    if (errorDetails.length > 0) {
      console.log('Error details:', errorDetails);
    }

    // Update sync state in Sanity
    try {
      const syncState = {
        _type: "syncState",
        _id: "order-sync-state",
        key: "order-sync",
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
        message: `Sync completed. Created: ${stats.created}, Updated: ${stats.updated}, Errors: ${stats.errors}`,
        errorDetails: errorDetails.slice(0, 10), // Return first 10 errors for debugging
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        stats: { created: 0, updated: 0, deleted: 0, errors: 1, total: 0 },
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
