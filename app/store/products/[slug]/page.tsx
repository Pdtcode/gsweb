import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { client } from "@/sanity/lib/client";
import { productBySlugQuery } from "@/lib/queries";
import { RealTimeProduct } from "@/components/real-time-product";
import { Product } from "@/types";
import { urlForImage } from "@/sanity/lib/image";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, buildMetadata, siteConfig } from "@/lib/seo";

export const revalidate = 0; // Always fetch fresh data - no caching

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getProduct(slug: string): Promise<Product | null> {
  return await client.fetch(productBySlugQuery, { slug });
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
