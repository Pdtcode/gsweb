 
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
    sku?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
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

/**
 * Decrement stock for all items in an order
 * Used when payment succeeds
 */
export async function decrementOrderStock(orderId: string) {
  console.log("\n=== DECREMENT ORDER STOCK STARTED ===");
  console.log("Order ID:", orderId);

  try {
    console.log("🔍 Fetching order details...");
    const order = await getOrderById(orderId);

    if (!order) {
      console.error(`❌ Order ${orderId} not found`);
      throw new Error(`Order ${orderId} not found`);
    }

    console.log(`✅ Order found: ${order.orderNumber}`);
    console.log(`Number of items to process: ${order.OrderItem.length}`);

    // Decrement stock for each order item
    for (let i = 0; i < order.OrderItem.length; i++) {
      const item = order.OrderItem[i];
      console.log(`\n--- Processing item ${i + 1}/${order.OrderItem.length} ---`);
      console.log("Item details:", {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        productName: item.Product?.name
      });

      let variant = null;

      if (item.sku) {
        console.log(`🔍 Looking for variant by SKU: ${item.sku}`);
        // Get variant by SKU if specified (preferred method)
        variant = await prisma.productVariant.findUnique({
          where: { sku: item.sku },
        });

        if (variant) {
          console.log(`✅ Variant found by SKU - ID: ${variant.id}, Current stock: ${variant.stock}`);
        } else {
          console.log(`⚠️ Variant with SKU ${item.sku} not found`);
        }
      } else if (item.variantId) {
        console.log(`🔍 Looking for variant by ID: ${item.variantId}`);
        // Get variant by ID if specified
        variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });

        if (variant) {
          console.log(`✅ Variant found by ID - SKU: ${variant.sku}, Current stock: ${variant.stock}`);
        } else {
          console.log(`⚠️ Variant with ID ${item.variantId} not found`);
        }
      } else if (item.productId) {
        console.log(`🔍 No SKU or variantId provided, searching for default variant for product: ${item.productId}`);

        // No SKU or variantId - find the default variant for this product
        variant = await prisma.productVariant.findFirst({
          where: {
            productId: item.productId,
            size: "Default"
          },
        });

        if (variant) {
          console.log(`✅ Found default variant - SKU: ${variant.sku}, Current stock: ${variant.stock}`);
        } else {
          console.log(`⚠️ No default variant found, trying to find any variant for this product...`);
          // Fallback: try to find any variant for this product
          variant = await prisma.productVariant.findFirst({
            where: { productId: item.productId },
          });

          if (variant) {
            console.log(`✅ Found fallback variant - SKU: ${variant.sku}, Current stock: ${variant.stock}`);
          } else {
            console.log(`❌ No variants found for product ${item.productId}`);
          }
        }
      }

      if (variant) {
        const oldStock = variant.stock;
        const newStock = Math.max(0, variant.stock - item.quantity);

        console.log(`📦 Decrementing stock for variant ${variant.id}:`);
        console.log(`   SKU: ${variant.sku}`);
        console.log(`   Old stock: ${oldStock}`);
        console.log(`   Quantity ordered: ${item.quantity}`);
        console.log(`   New stock: ${newStock}`);

        // Decrement the stock by the ordered quantity
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            stock: newStock
          },
        });
        console.log(`✅ Successfully decremented ${item.quantity} units from variant ${variant.id} (SKU: ${variant.sku})`);
      } else {
        console.error(`❌ No variant found for product ${item.productId}, cannot decrement stock`);
        console.error(`   This means inventory will NOT be decremented for this item!`);
      }
    }

    console.log(`\n✅ Stock decremented for order ${order.orderNumber}`);
    console.log("=== DECREMENT ORDER STOCK ENDED ===\n");
    return order;
  } catch (error) {
    console.error("❌ ERROR IN DECREMENT ORDER STOCK:", error);
    console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    throw error;
  }
}

/**
 * Restore stock for all items in an order
 * Used when payment fails or order is cancelled
 */
export async function restoreOrderStock(orderId: string) {
  try {
    const order = await getOrderById(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Restore stock for each order item
    for (const item of order.OrderItem) {
      let variant = null;

      if (item.sku) {
        // Get variant by SKU if specified (preferred method)
        variant = await prisma.productVariant.findUnique({
          where: { sku: item.sku },
        });
      } else if (item.variantId) {
        // Get variant by ID if specified
        variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
        });
      } else if (item.productId) {
        // No SKU or variantId - find the default variant for this product
        variant = await prisma.productVariant.findFirst({
          where: {
            productId: item.productId,
            size: "Default"
          },
        });

        if (!variant) {
          // Fallback: try to find any variant for this product
          variant = await prisma.productVariant.findFirst({
            where: { productId: item.productId },
          });
        }
      }

      if (variant) {
        // Restore the stock by adding back the quantity
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            stock: variant.stock + item.quantity
          },
        });
        console.log(`Restored ${item.quantity} units to variant ${variant.id} (SKU: ${variant.sku})`);
      } else {
        console.warn(`No variant found for product ${item.productId}, cannot restore stock`);
      }
    }

    console.log(`Stock restored for order ${order.orderNumber}`);
    return order;
  } catch (error) {
    console.error("Error restoring order stock:", error);
    throw error;
  }
}
