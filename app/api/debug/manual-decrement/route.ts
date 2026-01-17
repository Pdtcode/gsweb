import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    console.log(`=== MANUAL DECREMENT TEST ===`);
    console.log(`Order ID: ${orderId}`);

    // Get the order with its items and variants
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: {
          include: {
            Product: true,
            ProductVariant: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const results = [];

    for (const item of order.OrderItem) {
      console.log(`Processing item: ${item.Product?.name}`);
      console.log(`Variant ID: ${item.variantId}`);
      console.log(`Quantity: ${item.quantity}`);

      if (!item.variantId) {
        results.push({
          item: item.Product?.name,
          error: "No variant ID found"
        });
        continue;
      }

      // Get current stock before decrement
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId }
      });

      if (!variant) {
        results.push({
          item: item.Product?.name,
          error: `Variant ${item.variantId} not found`
        });
        continue;
      }

      const oldStock = variant.stock;
      const newStock = Math.max(0, variant.stock - item.quantity);

      console.log(`Old stock: ${oldStock}, New stock: ${newStock}`);

      // Update the stock
      const updatedVariant = await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: newStock }
      });

      results.push({
        item: item.Product?.name,
        sku: variant.sku,
        oldStock,
        newStock: updatedVariant.stock,
        decremented: item.quantity,
        success: true
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber: order.orderNumber,
      results
    });

  } catch (error) {
    console.error("Error in manual decrement:", error);
    return NextResponse.json(
      {
        error: "Failed to decrement stock",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}