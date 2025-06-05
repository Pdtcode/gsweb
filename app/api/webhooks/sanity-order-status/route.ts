import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import crypto from "crypto";

import prisma from "@/lib/prismaClient";

const sanityClient = createClient({
  projectId: "arbp7h2s",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

// Webhook secret for validation (you'll set this in Sanity webhook config)
const WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("No webhook secret configured - skipping signature verification");
    return true; // Allow in development, but log warning
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-sanity-signature");

    // Verify webhook signature for security
    if (signature && !verifySignature(body, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const webhook = JSON.parse(body);
    console.log("Received Sanity webhook:", webhook);

    // Only process order documents
    if (webhook._type !== "order") {
      console.log("Ignoring non-order webhook");
      return NextResponse.json({ message: "Not an order webhook" });
    }

    // Only process updates (not creates or deletes)
    if (!webhook.transition || webhook.transition !== "update") {
      console.log("Ignoring non-update webhook");
      return NextResponse.json({ message: "Not an update webhook" });
    }

    // Check if status field was changed
    const statusChanged = webhook.changedFields && 
      webhook.changedFields.some((field: string) => field === "status");

    if (!statusChanged) {
      console.log("Order updated but status unchanged");
      return NextResponse.json({ message: "Status not changed" });
    }

    // Extract order ID from Sanity _id (format: "order-{uuid}")
    const orderId = webhook._id.replace("order-", "");
    console.log(`Processing status change for order ${orderId}`);

    // Fetch the updated order from Sanity to get current status
    const sanityOrder = await sanityClient.fetch(
      `*[_type == "order" && _id == $id][0]`,
      { id: webhook._id }
    );

    if (!sanityOrder) {
      console.error(`Order ${webhook._id} not found in Sanity`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
    const newStatus = validStatuses.includes(sanityOrder.status as any) 
      ? sanityOrder.status as typeof validStatuses[number] 
      : 'PENDING';

    console.log(`Updating order ${orderId} status to: ${newStatus}`);

    // Update order status in database
    try {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: newStatus,
          // updatedAt is automatically managed by Prisma
        }
      });

      console.log(`Successfully updated order ${orderId} status to ${updatedOrder.status}`);

      // Create/update webhook sync state in Sanity
      try {
        const webhookSyncState = {
          _type: "syncState",
          _id: "webhook-order-status-sync",
          key: "webhook-order-status",
          lastSyncTime: new Date().toISOString(),
          syncStatus: "success",
          syncStats: {
            updated: 1,
            errors: 0,
            total: 1
          },
          lastOrderId: orderId,
          lastStatus: newStatus
        };

        await sanityClient.createOrReplace(webhookSyncState);
      } catch (error) {
        console.error("Error updating webhook sync state:", error);
        // Don't fail the webhook for this
      }

      return NextResponse.json({
        success: true,
        orderId,
        oldStatus: webhook.previousValue?.status,
        newStatus,
        message: `Order ${orderId} status updated to ${newStatus}`
      });

    } catch (dbError) {
      console.error(`Failed to update order ${orderId} in database:`, dbError);
      
      // Update sync state with error
      try {
        const webhookSyncState = {
          _type: "syncState",
          _id: "webhook-order-status-sync",
          key: "webhook-order-status",
          lastSyncTime: new Date().toISOString(),
          syncStatus: "failed",
          syncStats: {
            updated: 0,
            errors: 1,
            total: 1
          },
          lastOrderId: orderId,
          lastError: dbError instanceof Error ? dbError.message : "Unknown error"
        };

        await sanityClient.createOrReplace(webhookSyncState);
      } catch (error) {
        console.error("Error updating webhook sync state:", error);
      }

      return NextResponse.json(
        { 
          error: "Database update failed", 
          orderId,
          details: dbError instanceof Error ? dbError.message : "Unknown error"
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { 
        error: "Webhook processing failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "Sanity order status webhook endpoint",
    endpoint: "/api/webhooks/sanity-order-status"
  });
}