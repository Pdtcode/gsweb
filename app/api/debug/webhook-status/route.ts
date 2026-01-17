import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET(req: NextRequest) {
  try {
    // Check for webhook log for the specific payment intent
    const paymentIntentId = "pi_3SqTXJJ4AN3LH65i0RlclWAv";

    const webhookLog = await prisma.webhookLog.findUnique({
      where: { paymentIntentId: paymentIntentId }
    });

    // Get the order for this payment intent
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

    // Get current stock for the variant
    let currentVariantStock = null;
    if (order?.OrderItem[0]?.variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: order.OrderItem[0].variantId }
      });
      currentVariantStock = variant?.stock;
    }

    return NextResponse.json({
      paymentIntentId,
      webhookLogExists: !!webhookLog,
      webhookLog: webhookLog || null,
      orderExists: !!order,
      order: order ? {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        items: order.OrderItem.map(item => ({
          product: item.Product?.name,
          variantId: item.variantId,
          sku: item.ProductVariant?.sku,
          stockInOrderRecord: item.ProductVariant?.stock,
          quantity: item.quantity
        }))
      } : null,
      currentVariantStock,
      analysis: {
        webhookWasProcessed: !!webhookLog,
        orderWasFound: !!order,
        inventoryDecremented: currentVariantStock !== null ? currentVariantStock < 25 : "unknown",
        expectedStock: 24,
        actualStock: currentVariantStock
      }
    });

  } catch (error) {
    console.error("Error checking webhook status:", error);
    return NextResponse.json(
      {
        error: "Failed to check webhook status",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}