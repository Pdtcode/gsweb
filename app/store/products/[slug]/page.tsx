import type { Metadata } from "next";

import { cache } from "react";
import { notFound } from "next/navigation";

import { client } from "@/sanity/lib/client";
import { productBySlugQuery } from "@/lib/queries";
import { RealTimeProduct } from "@/components/real-time-product";
import { Product } from "@/types";
import { urlForImage } from "@/sanity/lib/image";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, buildMetadata, siteConfig } from "@/lib/seo";

// Product copy, pricing and imagery change rarely, so the page is prerendered
// and refreshed in the background once a minute rather than re-rendered per
// request. Stock is NOT served from this cache: <RealTimeProduct> fetches
// /api/products/[slug] on mount, so availability stays live however stale the
// surrounding HTML is.
//
// This was previously `revalidate = 0` ("always fetch fresh"), which cost a
// full server render plus a Sanity round trip on every view without actually
// delivering freshness — sanity/lib/client.ts runs with `useCdn: true`, so those
// reads were already up to ~60s behind.
export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// generateMetadata and the page body both need the product. Wrapping the fetch
// in React's cache() dedupes them into a single Sanity request per render
// instead of two.
const getProduct = cache(async (slug: string): Promise<Product | null> => {
  return await client.fetch(productBySlugQuery, { slug });
});

// Prerender a page per live product at build time. Anything not listed here
// (a product published after the build) still renders on demand and is cached
// from then on.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await client.fetch<string[]>(
    `*[_type == "product" && isActive != false && defined(slug.current)].slug.current`,
  );

  return slugs.map((slug) => ({ slug }));
}

function productImageUrl(product: Product): string | null {
  if (!product.mainImage) return null;

  try {
    return urlForImage(product.mainImage).width(1200).height(630).url();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return buildMetadata({
      title: "Product not found",
      path: `/store/products/${slug}`,
      noindex: true,
    });
  }

  const description =
    product.description?.slice(0, 160) ||
    `Shop ${product.name} at ${siteConfig.name}. Limited-edition streetwear with fast shipping or local pickup.`;

  return buildMetadata({
    title: product.name,
    description,
    path: `/store/products/${slug}`,
    image: productImageUrl(product),
    keywords: [
      product.name,
      ...(product.categories?.map((c) => c.title) ?? []),
      "streetwear",
      siteConfig.name,
    ],
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const image = productImageUrl(product);
  const url = absoluteUrl(`/store/products/${slug}`);

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: siteConfig.name,
      },
    },
  };

  return (
    <>
      <JsonLd data={productLd} />
      <RealTimeProduct initialProduct={product} slug={slug} />
    </>
  );
}
