import { NextRequest, NextResponse } from "next/server";
import { decrementOrderStock } from "@/app/actions/orderActions";
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

    console.log(`=== MANUAL INVENTORY DECREMENT TEST ===`);
    console.log(`Order ID: ${orderId}`);

    // Get order details before decrement
    const orderBefore = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: {
          include: {
            Product: { select: { name: true } },
            ProductVariant: { select: { sku: true, stock: true } }
          }
        }
      }
    });

    if (!orderBefore) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    console.log("Order before decrement:", {
      orderNumber: orderBefore.orderNumber,
      items: orderBefore.OrderItem.map(item => ({
        product: item.Product?.name,
        variant: item.ProductVariant?.sku,
        stockBefore: item.ProductVariant?.stock,
        quantity: item.quantity
      }))
    });

    // Perform the decrement
    await decrementOrderStock(orderId);

    // Get order details after decrement
    const orderAfter = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: {
          include: {
            Product: { select: { name: true } },
            ProductVariant: { select: { sku: true, stock: true } }
          }
        }
      }
    });

    const result = {
      success: true,
      orderId,
      orderNumber: orderBefore.orderNumber,
      beforeDecrement: orderBefore.OrderItem.map(item => ({
        product: item.Product?.name,
        variant: item.ProductVariant?.sku,
        stockBefore: item.ProductVariant?.stock,
        quantity: item.quantity
      })),
      afterDecrement: orderAfter?.OrderItem.map(item => ({
        product: item.Product?.name,
        variant: item.ProductVariant?.sku,
        stockAfter: item.ProductVariant?.stock,
        quantity: item.quantity
      }))
    };

    console.log("Decrement test result:", result);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error in manual decrement test:", error);
    return NextResponse.json(
      {
        error: "Failed to decrement order stock",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}