import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('orderId');

    if (!orderId) {
      // Get the most recent order if no ID provided
      const recentOrder = await prisma.order.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          OrderItem: {
            include: {
              Product: true,
              ProductVariant: true
            }
          }
        }
      });

      if (!recentOrder) {
        return NextResponse.json({ error: "No orders found" }, { status: 404 });
      }

      return NextResponse.json({
        order: recentOrder,
        debug: {
          orderItems: recentOrder.OrderItem.map(item => ({
            productId: item.productId,
            productName: item.Product?.name,
            variantId: item.variantId,
            variantExists: !!item.ProductVariant,
            variantSku: item.ProductVariant?.sku,
            variantStock: item.ProductVariant?.stock,
            variantSize: item.ProductVariant?.size,
            variantColor: item.ProductVariant?.color,
            quantity: item.quantity,
            issue: !item.ProductVariant ? "VARIANT NOT FOUND" : null
          }))
        }
      });
    }

    // Get specific order
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      order,
      debug: {
        orderItems: order.OrderItem.map(item => ({
          productId: item.productId,
          productName: item.Product?.name,
          variantId: item.variantId,
          variantExists: !!item.ProductVariant,
          variantSku: item.ProductVariant?.sku,
          variantStock: item.ProductVariant?.stock,
          variantSize: item.ProductVariant?.size,
          variantColor: item.ProductVariant?.color,
          quantity: item.quantity,
          issue: !item.ProductVariant ? "VARIANT NOT FOUND" : null
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching order details:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch order details",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}