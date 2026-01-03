import { notFound } from "next/navigation";

import { client } from "@/sanity/lib/client";
import { productBySlugQuery } from "@/lib/queries";
import { RealTimeProduct } from "@/components/real-time-product";
import { Product } from "@/types";

export const revalidate = 60; // Revalidate this page every 60 seconds

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getProduct(slug: string): Promise<Product | null> {
  return await client.fetch(productBySlugQuery, { slug });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <RealTimeProduct initialProduct={product} slug={slug} />
  );
}