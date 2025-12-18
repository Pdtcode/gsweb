import Link from "next/link";
import { notFound } from "next/navigation";

import { title } from "@/components/primitives";
import { client } from "@/sanity/lib/client";
import { productBySlugQuery } from "@/lib/queries";
import { AddToCartButtonWrapper } from "@/components/product-actions";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { Product, Collection } from "@/types";

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
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image Gallery */}
        <ProductImageGallery
          productName={product.name}
          mainImage={product.mainImage}
          additionalImages={product.images}
          inStock={product.inStock}
        />

        {/* Product Details */}
        <div className="space-y-6">
          <h1 className={title()}>{product.name}</h1>

          <div className="flex items-center gap-4">
            <p className="text-2xl font-bold">${product.price}</p>
            {product.comparePrice && product.comparePrice > product.price && (
              <p className="text-lg text-gray-500 line-through">
                ${product.comparePrice}
              </p>
            )}
          </div>

          {product.categories && product.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.categories.map((category) => (
                <Link
                  key={category._id}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm"
                  href={`/store/categories/${category.slug.current}`}
                >
                  {category.title}
                </Link>
              ))}
            </div>
          )}

          {product.description && (
            <div className="prose dark:prose-invert max-w-none">
              <p>{product.description}</p>
            </div>
          )}

          {/* Variant selector and cart buttons */}
          <AddToCartButtonWrapper product={product} />

          {/* Collection info */}
          {product.collections && product.collections.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <h2 className={title({ size: "sm", className: "mb-3" })}>
                Part of Collections
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.collections.map((collection: Collection) => (
                  <Link
                    key={collection._id}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-sm"
                    href={`/store/collections/${collection.slug.current}`}
                  >
                    {collection.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
