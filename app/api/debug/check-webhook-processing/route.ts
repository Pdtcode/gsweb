import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const paymentIntentId = url.searchParams.get('paymentIntentId');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId parameter is required" },
        { status: 400 }
      );
    }

    // Check if webhook was processed for this payment intent
    const webhookLog = await prisma.webhookLog.findUnique({
      where: { paymentIntentId: paymentIntentId }
    });

    // Also get the order directly by payment intent
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        OrderItem: {
          include: {
            Product: { select: { name: true } },
            ProductVariant: { select: { sku: true, stock: true } }
          }
        }
      }
    });

    return NextResponse.json({
      paymentIntentId,
      webhookProcessed: !!webhookLog,
      webhookLog,
      order,
      analysis: {
        orderExists: !!order,
        webhookLogExists: !!webhookLog,
        orderStatus: order?.status,
        inventoryDetails: order?.OrderItem.map(item => ({
          product: item.Product?.name,
          sku: item.ProductVariant?.sku,
          currentStock: item.ProductVariant?.stock,
          orderedQuantity: item.quantity,
          expectedStock: item.ProductVariant ? (item.ProductVariant.stock + item.quantity) : "N/A"
        }))
      }
    });

  } catch (error) {
    console.error("Error checking webhook processing:", error);
    return NextResponse.json(
      {
        error: "Failed to check webhook processing",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}