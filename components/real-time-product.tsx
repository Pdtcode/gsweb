"use client";

import { useState, useEffect } from "react";
import { title } from "@/components/primitives";
import { AddToCartButtonWrapper } from "@/components/product-actions";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { Product } from "@/types";

interface RealTimeProductProps {
  initialProduct: Product;
  slug: string;
}

export function RealTimeProduct({ initialProduct, slug }: RealTimeProductProps) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [isLoading, setIsLoading] = useState(false);

  // Function to refresh inventory data
  const refreshInventory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/products/${slug}`);
      if (response.ok) {
        const updatedProduct = await response.json();
        setProduct(updatedProduct);
      }
    } catch (error) {
      console.error("Failed to refresh inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch fresh inventory immediately on mount
  useEffect(() => {
    refreshInventory();
  }, [slug]);

  // Auto-refresh inventory every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshInventory, 30000);
    return () => clearInterval(interval);
  }, [slug]);

  // Calculate real-time stock display
  const displayStock = () => {
    if (product.realTimeTotalInventory !== undefined) {
      return product.realTimeTotalInventory;
    }
    return product.totalInventory || 0;
  };

  const isInStock = () => {
    if (product.realTimeInStock !== undefined) {
      return product.realTimeInStock;
    }
    return product.inStock;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image Gallery */}
        <ProductImageGallery
          productName={product.name}
          mainImage={product.mainImage}
          additionalImages={product.images}
          inStock={isInStock()}
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

          {product.description && (
            <div className="prose dark:prose-invert">
              <p>{product.description}</p>
            </div>
          )}

          {/* Enhanced Add to Cart with real-time variants */}
          <AddToCartButtonWrapper
            product={{
              ...product,
              // Use real-time inventory data if available
              ...(product.availableVariants && {
                variants: product.variants?.map(variant => {
                  // Check if product has multiple variant dimensions (Color + Size)
                  const hasMultipleDimensions = product.variants && product.variants.length > 1;

                  // Don't show stock counts on individual options if product has multiple dimensions
                  // Stock will only be shown after all variants are selected
                  if (hasMultipleDimensions) {
                    return {
                      ...variant,
                      options: variant.options
                    };
                  }

                  // For products with single variant dimension, show stock counts
                  return {
                    ...variant,
                    options: variant.options?.map(option => {
                      const matchingVariant = product.availableVariants?.find(av => {
                        if (variant.name === "Color") {
                          return av.color?.toLowerCase() === option.toLowerCase();
                        }
                        if (variant.name === "Size") {
                          return av.size?.toLowerCase() === option.toLowerCase();
                        }
                        return false;
                      });
                      return `${option}${matchingVariant ? ` (${matchingVariant.stock} left)` : ""}`;
                    })
                  };
                })
              })
            }}
          />

          <button
            onClick={refreshInventory}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {isLoading ? "Updating inventory..." : "Refresh inventory"}
          </button>
        </div>
      </div>
    </div>
  );
}