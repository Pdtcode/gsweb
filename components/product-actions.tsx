"use client";

import { useState } from "react";
import { Product } from "@/types";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { VariantSelector } from "@/components/variant-selector";
import { InventoryDisplay } from "@/components/inventory-display";
import { useSkuContext } from "@/lib/contexts/sku-context";

export function AddToCartButtonWrapper({ product }: { product: Product }) {
  const { getSkuByVariantOptions, skuData } = useSkuContext();
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

    // Use the SKU context to find the actual SKU from the database
    if (variant.size || variant.color) {
      const sku = getSkuByVariantOptions(
        product.slug?.current || '',
        variant.size,
        variant.color
      );

      if (sku) {
        variant.sku = sku;
        console.log('✅ Found SKU from database:', sku, 'for', variant);
      } else {
        console.log('❌ No SKU found for variant:', variant, 'in product:', product.slug?.current);
        // Fallback: try to find SKU from Sanity data (existing logic)
        if (product.variants) {
          for (const productVariant of product.variants) {
            if (!productVariant.inventory) continue;

            for (const inventoryItem of productVariant.inventory) {
              const option = inventoryItem.option;
              let matches = false;

              if (productVariant.name?.toLowerCase() === "color" && variant.color && variant.size) {
                const optionLower = option.toLowerCase();
                const colorLower = variant.color.toLowerCase();
                const sizeLower = variant.size.toLowerCase();
                matches = optionLower.includes(colorLower) && optionLower.includes(sizeLower);
              } else if (productVariant.name?.toLowerCase() === "size" && variant.size) {
                matches = option.toLowerCase() === variant.size.toLowerCase();
              } else if (variant.color && variant.size) {
                const optionLower = option.toLowerCase();
                const colorLower = variant.color.toLowerCase();
                const sizeLower = variant.size.toLowerCase();
                matches = optionLower.includes(colorLower) && optionLower.includes(sizeLower);
              } else if (variant.color) {
                matches = option.toLowerCase().includes(variant.color.toLowerCase());
              } else if (variant.size) {
                matches = option.toLowerCase().includes(variant.size.toLowerCase());
              }

              if (matches && inventoryItem.sku) {
                variant.sku = inventoryItem.sku;
                console.log('⚠️ Fallback: Found SKU from Sanity:', inventoryItem.sku);
                break;
              }
            }

            if (variant.sku) break;
          }
        }
      }
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
