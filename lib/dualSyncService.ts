import { createClient } from "@sanity/client";
import prisma from "@/lib/prismaClient";

const sanityClient = createClient({
  projectId: "arbp7h2s",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

interface OrderData {
  userId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  stripePaymentIntentId?: string;
  status?: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
}

interface OrderWithRelations {
  id: string;
  orderNumber: string;
  userId: string;
  total: any;
  status: string;
  stripePaymentIntentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  User: {
    email: string;
    name: string | null;
  };
  OrderItem: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    price: any;
    Product: {
      name: string;
    };
  }>;
}

export class DualSyncService {
  /**
   * Creates an order in both Neon and Sanity databases
   */
  static async createOrder(orderData: OrderData) {
    let neonOrder = null;

    try {
      // Create order in Neon (primary database)
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      neonOrder = await prisma.order.create({
        data: {
          orderNumber,
          userId: orderData.userId,
          total: orderData.total,
          status: orderData.status || "PENDING",
          stripePaymentIntentId: orderData.stripePaymentIntentId,
          OrderItem: {
            create: orderData.items.map(item => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
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
        },
      });

      // Sync to Sanity (secondary database)
      try {
        await this.syncOrderToSanity(neonOrder);
        console.log(`✅ Order synced to Sanity: ${neonOrder.orderNumber}`);
      } catch (syncError) {
        console.error(`❌ Order ${neonOrder.orderNumber} created in Neon but failed to sync to Sanity:`, syncError);
        // Continue even if Sanity sync fails - Neon is source of truth
      }

      return neonOrder;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  /**
   * Updates order status in both databases
   */
  static async updateOrderStatus(
    orderId: string,
    status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"
  ) {
    try {
      // Get the current order to check previous status
      const currentOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          OrderItem: {
            include: {
              ProductVariant: true,
            },
          },
        },
      });

      if (!currentOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      // If changing to CANCELLED and order was not already CANCELLED, restore stock
      if (status === "CANCELLED" && currentOrder.status !== "CANCELLED") {
        console.log(`Restoring stock for cancelled order ${currentOrder.orderNumber}`);

        for (const item of currentOrder.OrderItem) {
          if (item.variantId && item.ProductVariant) {
            await prisma.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: item.ProductVariant.stock + item.quantity
              },
            });
            console.log(`Restored ${item.quantity} units to variant ${item.variantId} (SKU: ${item.ProductVariant.sku})`);
          }
        }

        // Sync restored inventory to Sanity
        try {
          await this.syncInventoryToSanity(orderId);
          console.log(`✅ Restored inventory synced to Sanity for order ${currentOrder.orderNumber}`);
        } catch (syncError) {
          console.error(`Failed to sync restored inventory to Sanity for order ${currentOrder.orderNumber}:`, syncError);
          // Continue even if sync fails
        }
      }

      // Update in Neon
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status },
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
        },
      });

      // Update in Sanity
      try {
        await this.syncOrderToSanity(updatedOrder);
        console.log(`✅ Order status synced to Sanity for order ${updatedOrder.orderNumber}`);
      } catch (syncError) {
        console.error(`❌ Failed to sync order status to Sanity for order ${updatedOrder.orderNumber}:`, syncError);
        // Continue even if Sanity sync fails - Neon is source of truth
      }

      return updatedOrder;
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  /**
   * Syncs a single order to Sanity (DISABLED)
   * Neon is the source of truth for orders - no need to sync to Sanity
   */
  private static async syncOrderToSanity(order: OrderWithRelations) {
    console.log(`ℹ️ Order sync to Sanity skipped for ${order.orderNumber} - Neon is source of truth`);
    return; // Disabled - no sync needed
  }

  /**
   * Syncs an existing order by ID to Sanity (for manual fixes)
   */
  static async syncExistingOrderToSanity(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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
        },
      });

      if (!order) {
        throw new Error(`Order with ID ${orderId} not found`);
      }

      await this.syncOrderToSanity(order);
      return order;
    } catch (error) {
      console.error(`Error syncing existing order ${orderId} to Sanity:`, error);
      throw error;
    }
  }

  /**
   * Syncs inventory from Neon to Sanity after a purchase
   * Updates the inventory quantity in Sanity to match the current stock in Neon
   */
  /**
   * Syncs inventory changes to Sanity (DISABLED)
   *
   * This function is intentionally disabled because:
   * - Neon is the source of truth for inventory
   * - Sanity is only used as a UI to manage/view inventory
   * - Inventory flows: Sanity (UI) → Neon (source of truth) via webhook
   * - No need to sync back from Neon → Sanity
   */
  static async syncInventoryToSanity(orderId: string) {
    console.log(`ℹ️ Inventory sync to Sanity skipped for order ${orderId} - Neon is source of truth`);
    return; // Disabled - no sync needed
  }
}