/* eslint-disable no-console */
"use server";

import prisma from "@/lib/prismaClient";

/**
 * Get all orders for a specific user
 * This function ensures ONLY the specified user's orders are returned
 */
export async function getUserOrders(userId: string) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Explicitly filter by userId to ensure only the current user's orders are returned
    const orders = await prisma.order.findMany({
      where: {
        userId: userId, // This guarantees only the current user's orders
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return orders;
  } catch (error) {
    console.error("Error fetching user orders:", error);
    throw error;
  }
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: string) {
  try {
    if (!orderId) {
      throw new Error("Order ID is required");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
      },
    });

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    return order;
  } catch (error) {
    console.error("Error fetching order details:", error);
    throw error;
  }
}

/**
 * Create a new order in the database
 */
export async function createOrder(orderData: {
  userId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shippingAddressId?: string;
  stripePaymentIntentId?: string;
  status?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
}) {
  try {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: orderData.userId,
        total: orderData.total,
        status: orderData.status || "PENDING",
        stripePaymentIntentId: orderData.stripePaymentIntentId,
        shippingAddressId: orderData.shippingAddressId,
        items: {
          create: orderData.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
      },
    });

    return order;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
      },
    });

    return order;
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
}

/**
 * Get order by Stripe Payment Intent ID
 */
export async function getOrderByPaymentIntentId(paymentIntentId: string) {
  try {
    const order = await prisma.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
      },
    });

    return order;
  } catch (error) {
    console.error("Error fetching order by payment intent ID:", error);
    throw error;
  }
}
