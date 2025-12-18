"use client";

import { useState } from "react";
import { Product } from "@/types";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { VariantSelector } from "@/components/variant-selector";
import { InventoryDisplay } from "@/components/inventory-display";

export function AddToCartButtonWrapper({ product }: { product: Product }) {
  const [selectedVariant, setSelectedVariant] = useState<{
    size?: string;
    color?: string;
    sku?: string;
  }>({});

  const handleVariantChange = (selectedOptions: { [key: string]: string }) => {
    // Map variant options to the expected format
    // Common variant names: "Size", "Color", "size", "color"
    const variant: { size?: string; color?: string; sku?: string } = {};

    Object.keys(selectedOptions).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "size") {
        variant.size = selectedOptions[key];
      } else if (lowerKey === "color") {
        variant.color = selectedOptions[key];
      }
    });

    // Generate a simple SKU based on selected options
    if (variant.size || variant.color) {
      variant.sku = `${product.slug?.current || product._id}-${variant.size || 'default'}-${variant.color || 'default'}`;
    }

    setSelectedVariant(variant);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Variant Selector */}
      {product.variants && product.variants.length > 0 && (
        <VariantSelector
          variants={product.variants}
          onVariantChange={handleVariantChange}
        />
      )}

      {/* Inventory Display */}
      <InventoryDisplay
        product={product}
        selectedVariant={selectedVariant}
      />

      {/* Action Buttons */}
      <div className="flex gap-4 w-full">
        <AddToCartButton
          product={product}
          selectedVariant={Object.keys(selectedVariant).length > 0 ? selectedVariant : undefined}
        />

        {product.shopURL && (
          <a
            className="flex-1 inline-block bg-black dark:bg-white text-white dark:text-black font-medium px-6 py-3 rounded-lg hover:opacity-90 transition-opacity text-center"
            href={product.shopURL}
            rel="noopener noreferrer"
            target="_blank"
          >
            {product.inStock ? "Buy Now" : "View Product"}
          </a>
        )}
      </div>
    </div>
  );
}
