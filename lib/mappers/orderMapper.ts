/**
 * Centralized order mapper: Neon DB → Sanity CMS
 *
 * Purpose: Single source of truth for field mapping logic.
 * Eliminates duplicate mapping code and null/empty-string pollution.
 */

/**
 * Type representing a Neon order with all required relations loaded.
 * Matches the Prisma query shape used by both dualSyncService and sync-orders route.
 */
export interface NeonOrderWithRelations {
  id: string;
  orderNumber: string;
  userId: string;
  total: any; // Prisma Decimal type
  status: string;
  stripePaymentIntentId: string | null;
  shippingFirstName: string | null;
  shippingLastName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null; // Note: This is the street address in Neon
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
    price: any; // Prisma Decimal type
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

/**
 * Recursively filters out null and undefined values from an object.
 * Arrays are preserved as-is (filtering happens on individual array item fields).
 *
 * This prevents empty strings and null values from being synced to Sanity.
 */
export function filterNullishValues<T extends Record<string, any>>(
  obj: T
): T {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          // For arrays, recursively filter each item but keep the array
          return [k, v.map(item =>
            typeof item === 'object' && item !== null
              ? filterNullishValues(item)
              : item
          )];
        } else if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
          // For nested objects (not Dates), recurse
          return [k, filterNullishValues(v)];
        }
        return [k, v];
      })
  ) as T;
}

/**
 * Maps a Neon order with relations to a Sanity order document.
 *
 * Key behaviors:
 * - Uses ?? undefined (NOT || "") to avoid empty-string pollution
 * - Builds nested shippingAddress object from flat Neon fields
 * - Maps Neon shippingZipCode → Sanity postalCode
 * - Includes _key on all array items (Sanity requirement)
 * - Filters out nullish values via filterNullishValues()
 *
 * @param order - Neon order with User and OrderItem relations loaded
 * @returns Plain object suitable for sanityClient.createOrReplace()
 */
export function mapNeonOrderToSanity(order: NeonOrderWithRelations) {
  const doc = {
    _id: `order-${order.id}`,
    _type: 'order' as const,
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerEmail: order.User.email,
    total: Number(order.total),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),

    // Nested shipping address object (CRITICAL: fixes disappearing addresses)
    shippingAddress: {
      name: [order.shippingFirstName, order.shippingLastName]
        .filter(Boolean)
        .join(' '),
      street: order.shippingAddress ?? undefined, // Note: Neon field is shippingAddress (= street)
      city: order.shippingCity ?? undefined,
      state: order.shippingState ?? undefined,
      postalCode: order.shippingZipCode ?? undefined, // Neon=shippingZipCode, Sanity=postalCode
      country: order.shippingCountry ?? undefined,
    },

    // Flat shipping fields for backwards compatibility
    shippingFirstName: order.shippingFirstName ?? undefined,
    shippingLastName: order.shippingLastName ?? undefined,
    shippingEmail: order.shippingEmail ?? undefined,
    shippingPhone: order.shippingPhone ?? undefined,
    shippingCity: order.shippingCity ?? undefined,
    shippingState: order.shippingState ?? undefined,
    shippingZipCode: order.shippingZipCode ?? undefined,
    shippingCountry: order.shippingCountry ?? undefined,

    // Items array
    items: order.OrderItem.map((item) => ({
      _key: item.id, // Sanity requires _key on array items
      itemId: item.id,
      productId: item.productId,
      name: item.Product.name,
      quantity: item.quantity,
      price: Number(item.price),
      variantId: item.variantId ?? undefined,
      sku: item.ProductVariant?.sku ?? undefined,
      color: item.ProductVariant?.color ?? undefined,
      size: item.ProductVariant?.size ?? undefined,
    })),

    // Optional fields (only include if truthy)
    ...(order.stripePaymentIntentId && { stripePaymentIntentId: order.stripePaymentIntentId }),
    ...(order.User.name && { customerName: order.User.name }),
  };

  // Filter out all nullish values before returning
  return filterNullishValues(doc);
}
