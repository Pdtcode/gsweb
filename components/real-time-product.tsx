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

          {/* Add to Cart — stock counts are shown by InventoryDisplay once
              every variant dimension is selected, not on the option buttons */}
          <AddToCartButtonWrapper product={product} />

          <button
            onClick={refreshInventory}
            disabled={isLoading}
            className="text-sm hidden text-blue-600 hover:text-blue-800 underline"
          >
            {isLoading ? "Updating inventory..." : "Refresh inventory"}
          </button>
        </div>
      </div>
    </div>
  );
}