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
    sku?: string;
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
  shippingFirstName: string | null;
  shippingLastName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZipCode: string | null;
  shippingCountry: string | null;
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
    ProductVariant?: {
      sku: string;
      color: string | null;
      size: string | null;
    } | null;
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
              sku: item.sku,
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
              ProductVariant: {
                select: {
                  sku: true,
                  color: true,
                  size: true,
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
              ProductVariant: {
                select: {
                  sku: true,
                  color: true,
                  size: true,
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
   * Syncs a single order to Sanity
   * Creates or updates the order document in Sanity to mirror Neon data
   */
  private static async syncOrderToSanity(order: OrderWithRelations) {
    try {
      // Use order ID as the Sanity document ID for consistent upserts
      const sanityDocId = `order-${order.id}`;

      const sanityOrder = {
        _id: sanityDocId,
        _type: "order",
        orderNumber: order.orderNumber,
        userId: order.userId,
        customerEmail: order.User.email,
        customerName: order.User.name || "",
        total: Number(order.total),
        status: order.status,
        stripePaymentIntentId: order.stripePaymentIntentId || "",
        // Map Neon DB individual shipping fields to Sanity's nested shippingAddress object
        shippingAddress: {
          name: `${order.shippingFirstName || ""} ${order.shippingLastName || ""}`.trim(),
          street: order.shippingAddress || "",
          city: order.shippingCity || "",
          state: order.shippingState || "",
          postalCode: order.shippingZipCode || "",
          country: order.shippingCountry || "",
        },
        // Also include individual fields for backwards compatibility
        shippingFirstName: order.shippingFirstName || "",
        shippingLastName: order.shippingLastName || "",
        shippingEmail: order.shippingEmail || "",
        shippingPhone: order.shippingPhone || "",
        shippingCity: order.shippingCity || "",
        shippingState: order.shippingState || "",
        shippingZipCode: order.shippingZipCode || "",
        shippingCountry: order.shippingCountry || "",
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.OrderItem.map((item) => ({
          _key: item.id,
          itemId: item.id,
          productId: item.productId,
          variantId: item.variantId || "",
          name: item.Product.name,
          sku: item.ProductVariant?.sku || "",
          color: item.ProductVariant?.color || "",
          size: item.ProductVariant?.size || "",
          quantity: item.quantity,
          price: Number(item.price),
        })),
      };

      await sanityClient.createOrReplace(sanityOrder);
      console.log(`✅ Order ${order.orderNumber} synced to Sanity`);
    } catch (error) {
      console.error(`❌ Failed to sync order ${order.orderNumber} to Sanity:`, error);
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
              ProductVariant: {
                select: {
                  sku: true,
                  color: true,
                  size: true,
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
   * This ensures the product page displays the correct stock value
   */
  static async syncInventoryToSanity(orderId: string) {
    console.log(`📦 Starting inventory sync to Sanity for order ${orderId}`);

    try {
      // Get the order with its items and variants
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
        console.error(`Order ${orderId} not found for inventory sync`);
        return;
      }

      // Process each order item
      for (const item of order.OrderItem) {
        let variant = item.ProductVariant;

        // If no variant on the order item, try to find the default variant
        if (!variant && item.productId) {
          variant = await prisma.productVariant.findFirst({
            where: {
              productId: item.productId,
              size: "Default",
            },
          });

          if (!variant) {
            variant = await prisma.productVariant.findFirst({
              where: { productId: item.productId },
            });
          }
        }

        if (!variant) {
          console.log(`No variant found for product ${item.productId}, skipping Sanity sync`);
          continue;
        }

        // Get the product to find its Sanity ID
        const product = item.Product || await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          console.log(`Product ${item.productId} not found, skipping Sanity sync`);
          continue;
        }

        // Update Sanity with the new stock value
        // The product ID in Neon might be a Sanity ID or we need to find it by slug
        const sanityProductId = product.id;
        const newStock = variant.stock;

        console.log(`Syncing stock to Sanity: Product ${product.name}, SKU ${variant.sku}, Stock ${newStock}`);

        try {
          // Fetch the current Sanity product to determine its structure
          const sanityProduct = await sanityClient.fetch(
            `*[_type == "product" && _id == $id][0]`,
            { id: sanityProductId }
          );

          if (!sanityProduct) {
            // Try to find by slug
            const sanityProductBySlug = await sanityClient.fetch(
              `*[_type == "product" && slug.current == $slug][0]`,
              { slug: product.slug }
            );

            if (!sanityProductBySlug) {
              console.log(`Product ${product.name} not found in Sanity by ID or slug`);
              continue;
            }

            // Update using slug-found product
            await this.updateSanityProductInventory(sanityProductBySlug, variant.sku, newStock);
          } else {
            await this.updateSanityProductInventory(sanityProduct, variant.sku, newStock);
          }

          console.log(`✅ Synced stock to Sanity for ${product.name}: ${newStock}`);
        } catch (sanityError) {
          console.error(`Failed to sync ${product.name} to Sanity:`, sanityError);
        }
      }

      console.log(`✅ Inventory sync to Sanity completed for order ${orderId}`);
    } catch (error) {
      console.error(`Error syncing inventory to Sanity for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Updates a Sanity product's inventory based on its structure
   */
  private static async updateSanityProductInventory(
    sanityProduct: any,
    sku: string,
    newStock: number
  ) {
    // Check if product has variants
    if (sanityProduct.variants && sanityProduct.variants.length > 0) {
      // Product has variants - find and update the matching inventory item
      const updatedVariants = sanityProduct.variants.map((variant: any) => {
        if (!variant.inventory) return variant;

        const updatedInventory = variant.inventory.map((inv: any) => {
          if (inv.sku === sku) {
            return { ...inv, quantity: newStock };
          }
          return inv;
        });

        return { ...variant, inventory: updatedInventory };
      });

      await sanityClient
        .patch(sanityProduct._id)
        .set({ variants: updatedVariants })
        .commit();
    } else {
      // Product without variants - update totalInventory
      await sanityClient
        .patch(sanityProduct._id)
        .set({ totalInventory: newStock })
        .commit();
    }
  }
}