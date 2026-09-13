import type { Metadata } from "next";

import StoreContent from "./store-content";

import { client } from "@/sanity/lib/client";
import {
  allProductsQuery,
  categoriesQuery,
  featuredCollectionsQuery,
} from "@/lib/queries";
import { buildMetadata } from "@/lib/seo";
import { getActiveBundles } from "@/lib/bundles";

export const revalidate = 60; // Revalidate this page every 60 seconds

export const metadata: Metadata = buildMetadata({
  title: "Store",
  description:
    "Shop the full Grail Seekers collection — limited-edition hoodies, tees, and accessories. Fast shipping or local pickup.",
  path: "/store",
});

async function getStoreData() {
  const products = await client.fetch(allProductsQuery);
  const categories = await client.fetch(categoriesQuery);
  const featuredCollections = await client.fetch(featuredCollectionsQuery);
  // Bundle stock is derived from Neon, so this refreshes with the page's
  // 60s revalidate window rather than being cached indefinitely.
  const bundles = await getActiveBundles();

  return {
    products,
    categories,
    featuredCollections,
    bundles,
  };
}

export default async function StorePage() {
  const { products, categories, featuredCollections, bundles } =
    await getStoreData();

  return (
    <StoreContent
      bundles={bundles}
      categories={categories}
      featuredCollections={featuredCollections}
      products={products}
    />
  );
}
