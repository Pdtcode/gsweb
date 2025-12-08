import { NextResponse } from "next/server";
import { createClient } from "@sanity/client";

import prisma from "@/lib/prismaClient";

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
  try {
    const stats: SyncStats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      total: 0,
    };

    // Fetch orders from Neon DB
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
          },
        },
        Address: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    stats.total = orders.length;

    // Sync each order to Sanity
    for (const order of orders) {
      try {
        const sanityOrder = {
          _type: "order",
          _id: `order-${order.id}`,
          orderNumber: order.orderNumber,
          userId: order.userId,
          customerEmail: order.User.email,
          customerName: order.User.name || "",
          total: parseFloat(order.total.toString()),
          status: order.status,
          OrderItem: order.OrderItem.map(
            (item: {
              id: any;
              productId: any;
              variantId: any;
              Product: { name: any };
              quantity: any;
              price: { toString: () => string };
            }) => ({
              _key: `item-${item.id}`,
              itemId: item.id,
              productId: item.productId,
              variantId: item.variantId,
              name: item.Product.name,
              quantity: item.quantity,
              price: parseFloat(item.price.toString()),
            }),
          ),
          Address: order.Address
            ? {
                name: order.User.name || "",
                street: order.Address.street,
                city: order.Address.city,
                state: order.Address.state,
                postalCode: order.Address.postalCode,
                country: order.Address.country,
              }
            : undefined,
          stripePaymentIntentId: order.stripePaymentIntentId,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        };

        // Check if order already exists in Sanity
        const existingOrder = await sanityClient.fetch(
          '*[_type == "order" && _id == $id][0]',
          { id: `order-${order.id}` },
        );

        if (existingOrder) {
          // Update existing order
          await sanityClient.createOrReplace(sanityOrder);
          stats.updated++;
        } else {
          // Create new order
          await sanityClient.create(sanityOrder);
          stats.created++;
        }
      } catch (error) {
        console.error(`Error syncing order ${order.id}:`, error);
        stats.errors++;
      }
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
        success: true,
        stats,
        message: `Sync completed. Created: ${stats.created}, Updated: ${stats.updated}, Errors: ${stats.errors}`,
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
