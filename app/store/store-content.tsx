"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

import { title } from "@/components/primitives";
import { urlForImage } from "@/sanity/lib/image";
import { Category, Collection, Product } from "@/types";

// SKU Data Types
interface ProductSku {
  productId: string;
  productName: string;
  productSlug: string;
  variants: {
    id: string;
    sku: string;
    size: string;
    color: string | null;
    stock: number;
  }[];
}

interface SkuLookup {
  [sku: string]: {
    productId: string;
    productName: string;
    variantId: string;
    size: string;
    color: string | null;
    stock: number;
  };
}

// Giveaway Section Component
//function GiveawaySection() {
//  return (
//    <div className="mb-12 p-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
//      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
//        <div className="flex-1">
//          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-3">
//            GIVEAWAY
//          </span>
//          <h2 className="text-2xl md:text-3xl font-bold mb-3">
//            Win a Trip to Japan!
//          </h2>
//          <p className="text-white/90 mb-4">
//            We&apos;re giving away free round trip to Japan to our community. Here&apos;s how you can enter:
//          </p>
//
//          <div className="space-y-2 mb-2">
//            <h3 className="font-semibold">How to Enter:</h3>
//            <ul className="list-disc list-inside text-white/90 space-y-1 text-sm">
//              <li>Must be 21+ to enter</li>
//              <li>Must have a valid passport</li>
//              <li>Open to US residents only</li>
//              <li>Follow us on Instagram @gsdesignresearch</li>
//              <li>Spend a minimum of $80</li>
//              <li>Crash Test Hoodies will give you six slots for the giveaway</li>
//              <li>Winner will be announced Feb 9</li>
//            </ul>
//          </div>
//        </div>
//
//        <div className="flex-shrink-0">
//          <a
//            href="https://instagram.com/gsdesignresearch"
//            target="_blank"
//            rel="noopener noreferrer"
//            className="inline-block px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
//          >
//            Enter Giveaway
//          </a>
//        </div>
//      </div>
//    </div>
//  );
//}

export default function StoreContent({
  products,
  categories,
  featuredCollections,
}: {
  products: Product[];
  categories: Category[];
  featuredCollections: Collection[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [skuData, setSkuData] = useState<{
    products: ProductSku[];
    skuLookup: SkuLookup;
  } | null>(null);
  const [isLoadingSkus, setIsLoadingSkus] = useState(true);

  // Fetch SKU data from Neon database on component mount
  useEffect(() => {
    async function fetchSkus() {
      try {
        setIsLoadingSkus(true);
        const response = await fetch('/api/products/skus');

        if (!response.ok) {
          throw new Error('Failed to fetch SKUs');
        }

        const data = await response.json();
        setSkuData({
          products: data.products,
          skuLookup: data.skuLookup,
        });

        console.log('✅ SKU data loaded:', {
          totalProducts: data.totalProducts,
          totalVariants: data.totalVariants,
          sampleSkus: Object.keys(data.skuLookup).slice(0, 5)
        });
      } catch (error) {
        console.error('❌ Failed to load SKU data:', error);
      } finally {
        setIsLoadingSkus(false);
      }
    }

    fetchSkus();
  }, []);

  // Filter products based on selected category
  const filteredProducts = selectedCategory
    ? products.filter(
        (product) =>
          product.categories &&
          product.categories.some((cat) => cat._id === selectedCategory._id),
      )
    : products;

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Featured Collections */}
      {featuredCollections.length > 0 && (
        <div className="mb-12">
          <h2 className={title({ size: "md", className: "mb-4" }).toString()}>
            Featured Collections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredCollections.map((collection) => (
              <Link
                key={collection._id}
                className="group"
                href={`/store/collections/${collection.slug.current}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-lg mb-2">
                  {collection.mainImage && (
                    <Image
                      fill
                      alt={collection.title}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      src={urlForImage(collection.mainImage).url() || ""}
                    />
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end p-4">
                    <h3 className="text-white text-xl font-bold">
                      {collection.title}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  {collection.collectionType} Collection
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Giveaway Section  <GiveawaySection />*/}


      {/* Categories */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-3">
          <button
            className={`px-4 py-2 rounded-full transition-colors ${
              selectedCategory === null
                ? "bg-gray-300 dark:bg-gray-700"
                : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category._id}
              className={`px-4 py-2 rounded-full transition-colors ${
                selectedCategory && selectedCategory._id === category._id
                  ? "bg-gray-300 dark:bg-gray-700"
                  : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category.title}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="">
        <div className="flex items-center gap-3 mb-4">
          <h2 className={title({ size: "md" }).toString()}>
            {selectedCategory ? `${selectedCategory.title} Products` : "Products"}
            {selectedCategory && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
                ({filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "product" : "products"})
              </span>
            )}
          </h2>

          {/* SKU Loading/Status Indicator */}
          <div className="items-center gap-2 hidden">
            {isLoadingSkus ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                Loading SKUs...
              </div>
            ) : skuData ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                SKU data loaded ({Object.keys(skuData.skuLookup).length} variants)
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                SKU data failed to load
              </div>
            )}
          </div>
        </div>
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 mt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Link
                key={product._id}
                className="group"
                href={`/store/products/${product.slug.current}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-lg mb-2">
                  {product.mainImage && (
                    <Image
                      fill
                      alt={product.name}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      src={urlForImage(product.mainImage).url() || ""}
                    />
                  )}
                  {!product.inStock && (
                    <div className="absolute top-2 right-2 bg-black text-white px-2 py-1 text-xs rounded">
                      Sold Out
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-lg group-hover:underline">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="font-bold">${product.price}</p>
                  {product.comparePrice &&
                    product.comparePrice > product.price && (
                      <p className="text-gray-500 line-through">
                        ${product.comparePrice}
                      </p>
                    )}
                </div>
                {product.categories && product.categories.length > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {product.categories[0].title}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No products found in this category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
