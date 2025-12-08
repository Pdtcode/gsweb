 
"use server";

import prisma from "@/lib/prismaClient";
import { DualSyncService } from "@/lib/dualSyncService";

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
        OrderItem: {
          include: {
            Product: true,
            ProductVariant: true,
          },
        },
        Address: true,
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
        OrderItem: {
          include: {
            Product: true,
            ProductVariant: true,
          },
        },
        Address: true,
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
 * Create a new order in both databases (Neon and Sanity)
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
    // Use dual-sync service to create order in both databases
    const order = await DualSyncService.createOrder(orderData);
    return order;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
}

/**
 * Update order status in both databases (Neon and Sanity)
 */
export async function updateOrderStatus(
  orderId: string,
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
) {
  try {
    // Use dual-sync service to update order status in both databases
    const order = await DualSyncService.updateOrderStatus(orderId, status);
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
        OrderItem: {
          include: {
            Product: true,
            ProductVariant: true,
          },
        },
        Address: true,
      },
    });

    return order;
  } catch (error) {
    console.error("Error fetching order by payment intent ID:", error);
    throw error;
  }
}

/**
 * Manually sync an existing order to Sanity (for fixing sync issues)
 */
export async function syncOrderToSanity(orderId: string) {
  try {
    const order = await DualSyncService.syncExistingOrderToSanity(orderId);
    return order;
  } catch (error) {
    console.error("Error syncing order to Sanity:", error);
    throw error;
  }
}
