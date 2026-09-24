import { createClient } from "@sanity/client";

import prisma from "@/lib/prismaClient";

/**
 * Sanity → Neon product sync, shared by the Sanity product webhook
 * (app/api/sanity-webhook) and the manual endpoint (app/api/sync-inventory).
 *
 * Product content (name, price, description, main image, active flag) is
 * copied onto the Neon Product. Variants are created with their starting
 * quantity the first time a SKU is seen; after that stock is never touched —
 * Neon is the source of truth, changed only by orders and the Studio
 * inventory panel.
 */

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

export interface ProductSyncResult {
  productName: string;
  action: string;
  variantSku?: string;
  quantity?: number;
  currentStock?: number;
  sanityQuantity?: number;
  error?: string;
}

// Variant options are stored as "White Medium" (Color variants: colour first)
// or "Medium" (Size variants). Checkout looks variants up by these values.
function parseOption(variantName: string | undefined, option: string) {
  if (variantName === "Color") {
    const parts = option.split(" ");

    if (parts.length >= 2) {
      return { color: parts[0], size: parts.slice(1).join(" ") };
    }

    return { color: option, size: "One Size" };
  }

  if (variantName === "Size") {
    return { size: option, color: "Size" };
  }

  return { size: option, color: variantName || "Default" };
}

function mainImageUrl(sanityProduct: any): string[] {
  if (!sanityProduct.mainImage?.asset?._ref) return [];

  const file = sanityProduct.mainImage.asset._ref
    .replace("image-", "")
    .replace("-jpg", ".jpg")
    .replace("-png", ".png");

  return [
    `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${file}`,
  ];
}

async function syncProduct(sanityProduct: any, results: ProductSyncResult[]) {
  const productData = {
    name: sanityProduct.name,
    description: sanityProduct.description || "",
    price: sanityProduct.price || 0,
    images: mainImageUrl(sanityProduct),
    inStock: sanityProduct.inStock ?? true,
    // Absent in Sanity means the product predates the Studio toggle,
    // which means live.
    isActive: sanityProduct.isActive !== false,
  };

  let dbProduct = await prisma.product.findFirst({
    where: {
      OR: [
        { id: sanityProduct._id },
        { slug: sanityProduct.slug?.current },
        { name: sanityProduct.name },
      ],
    },
  });

  dbProduct = dbProduct
    ? await prisma.product.update({ where: { id: dbProduct.id }, data: productData })
    : await prisma.product.create({
        data: {
          ...productData,
          slug: sanityProduct.slug?.current || `product-${Date.now()}`,
        },
      });

  const inventoryItems: { sku: string; quantity: number; size: string; color: string | null }[] = [];

  if (sanityProduct.variants && sanityProduct.variants.length > 0) {
    for (const variant of sanityProduct.variants) {
      for (const item of variant.inventory || []) {
        inventoryItems.push({
          sku: item.sku || `${sanityProduct.slug?.current}-${item.option}`,
          quantity: item.quantity || 0,
          ...parseOption(variant.name, item.option),
        });
      }
    }
  } else if (sanityProduct.totalInventory !== undefined) {
    inventoryItems.push({
      sku: sanityProduct.sku || `${sanityProduct.slug?.current}-default`,
      quantity: sanityProduct.totalInventory || 0,
      size: "Default",
      color: null,
    });
  }

  for (const item of inventoryItems) {
    const dbVariant = await prisma.productVariant.findFirst({
      where: { productId: dbProduct.id, sku: item.sku },
    });

    if (dbVariant) {
      // Stock is NOT updated — Neon is the source of truth for inventory
      await prisma.productVariant.update({
        where: { id: dbVariant.id },
        data: { size: item.size, color: item.color },
      });

      results.push({
        productName: sanityProduct.name,
        variantSku: item.sku,
        action: "updated (stock preserved)",
        currentStock: dbVariant.stock,
        sanityQuantity: item.quantity,
      });
    } else {
      await prisma.productVariant.create({
        data: {
          productId: dbProduct.id,
          sku: item.sku,
          size: item.size,
          color: item.color,
          stock: item.quantity,
        },
      });

      results.push({
        productName: sanityProduct.name,
        variantSku: item.sku,
        action: "created",
        quantity: item.quantity,
      });
    }
  }
}

/**
 * Syncs one published product (by Sanity _id), or every published product when
 * no id is given. Drafts are never synced — only what has been published.
 */
export async function syncProductsFromSanity(productId?: string): Promise<ProductSyncResult[]> {
  const products: any[] = productId
    ? [await sanityClient.fetch(`*[_type == "product" && _id == $productId][0]`, { productId })].filter(Boolean)
    : await sanityClient.fetch(`*[_type == "product" && !(_id in path("drafts.**"))]`);

  const results: ProductSyncResult[] = [];

  for (const sanityProduct of products) {
    try {
      await syncProduct(sanityProduct, results);
    } catch (error) {
      console.error(`Error syncing product ${sanityProduct.name}:`, error);
      results.push({
        productName: sanityProduct.name,
        action: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * A product deleted in Sanity is hidden from the store rather than removed
 * from Neon, so existing orders keep their product and variant rows.
 */
export async function hideDeletedProduct(productId: string, slug?: string | null) {
  // Products created by the sync get their own id, so match on slug too
  const { count } = await prisma.product.updateMany({
    where: { OR: [{ id: productId }, ...(slug ? [{ slug }] : [])] },
    data: { isActive: false },
  });

  return count;
}
