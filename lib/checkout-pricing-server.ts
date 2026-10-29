import { createClient } from "@sanity/client";

import { promoCodeByCodeQuery } from "@/lib/queries";
import type { PromoCode } from "@/lib/promo";

// Checkout reads prices and promo codes straight from Sanity's API, not the
// CDN (which can be ~60 s stale), so a customer is charged what the Studio says
// right now — whatever their localStorage cart remembers.
const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
});

/**
 * Current Sanity price for each cart product id. A cart line's id is the
 * product's Sanity _id for most lines but its slug for some, so both are keyed.
 * Products with no price set are left out — the caller treats them as missing.
 */
export async function getProductPrices(ids: string[]): Promise<Map<string, number>> {
  const products = await sanityClient.fetch<Array<{ _id: string; slug?: string; price?: number }>>(
    `*[_type == "product" && (_id in $ids || slug.current in $ids)]{ _id, "slug": slug.current, price }`,
    { ids },
    { cache: "no-store" },
  );

  const prices = new Map<string, number>();

  for (const product of products) {
    if (typeof product.price !== "number" || !Number.isFinite(product.price)) continue;

    prices.set(product._id, product.price);
    if (product.slug) prices.set(product.slug, product.price);
  }

  return prices;
}

/** The promo code as it stands in Sanity right now, or null if there is none. */
export async function getPromoCode(code: string): Promise<PromoCode | null> {
  return sanityClient.fetch<PromoCode | null>(
    promoCodeByCodeQuery,
    { code: code.toUpperCase() },
    { cache: "no-store" },
  );
}
