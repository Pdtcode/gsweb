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
      await this.syncOrderToSanity(neonOrder);

      return neonOrder;
    } catch (error) {
      console.error("Error creating order:", error);

      // If Neon order was created but Sanity sync failed, log for manual review
      if (neonOrder) {
        console.error(`Order ${neonOrder.id} created in Neon but failed to sync to Sanity:`, error);
      }

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
      await this.syncOrderToSanity(updatedOrder);

      return updatedOrder;
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  /**
   * Syncs a single order to Sanity
   */
  private static async syncOrderToSanity(order: OrderWithRelations) {
    try {
      const sanityOrder = {
        _type: "order",
        _id: `order-${order.id}`,
        orderNumber: order.orderNumber,
        userId: order.userId,
        customerEmail: order.User.email,
        customerName: order.User.name || "",
        total: parseFloat(order.total.toString()),
        status: order.status,
        items: order.OrderItem.map((item) => ({
          _key: `item-${item.id}`,
          itemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          name: item.Product.name,
          quantity: item.quantity,
          price: parseFloat(item.price.toString()),
        })),
        shippingAddress: undefined,
        stripePaymentIntentId: order.stripePaymentIntentId,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      };

      // Use createOrReplace to handle both new orders and updates
      await sanityClient.createOrReplace(sanityOrder);

      console.log(`Successfully synced order ${order.id} to Sanity`);
    } catch (error) {
      console.error(`Failed to sync order ${order.id} to Sanity:`, error);
      throw error;
    }
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
}