"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Product } from "@/types";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { VariantSelector } from "@/components/variant-selector";
import { InventoryDisplay } from "@/components/inventory-display";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useSkuContext } from "@/lib/contexts/sku-context";
import { availableQuantityFor, selectOptionPrompt } from "@/lib/product-stock";

// Loaded on its own so Stripe doesn't weigh down every product page's first paint
const ProductExpressCheckout = dynamic(
  () =>
    import("@/components/product-express-checkout").then(
      (module) => module.ProductExpressCheckout,
    ),
  { ssr: false },
);

export function AddToCartButtonWrapper({ product }: { product: Product }) {
  const { getSkuByVariantOptions, skuData } = useSkuContext();
  const [selectedVariant, setSelectedVariant] = useState<{
    size?: string;
    color?: string;
    sku?: string;
  }>({});
  const [chosenQuantity, setChosenQuantity] = useState(1);
  const chosenVariant = Object.keys(selectedVariant).length > 0 ? selectedVariant : undefined;

  // Stays at 1 until every option is chosen, since only then is the stock known.
  // A quantity above the stock of a newly picked option comes down to fit.
  const available = availableQuantityFor(product, chosenVariant);
  const maxQuantity = Math.max(available, 1);
  const quantity = Math.min(chosenQuantity, maxQuantity);

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
          availableVariants={product.availableVariants}
          variants={product.variants}
          onVariantChange={handleVariantChange}
        />
      )}

      {/* Inventory Display */}
      <InventoryDisplay
        product={product}
        selectedVariant={selectedVariant}
      />

      {/* Action Buttons. On phones this is a bar stuck to the bottom of the screen,
          so buying stays in reach while scrolling through photos. */}
      <div className="product-buy-bar fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-4 border-t border-gray-200 bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:static md:border-0 md:bg-transparent md:p-0 dark:border-gray-800">
        <QuantityStepper
          disabled={available === 0}
          max={maxQuantity}
          quantity={quantity}
          onChange={setChosenQuantity}
        />
        <AddToCartButton
          className="min-w-0 flex-1 md:flex-none"
          product={product}
          quantity={quantity}
          selectedVariant={chosenVariant}
          onAdded={() => setChosenQuantity(1)}
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

      {/* Buys this item straight away, leaving the cart as it is. Sits in the page
          rather than the phone's sticky bar, which is already full. */}
      {available !== 0 && (
        <ProductExpressCheckout
          optionPrompt={available === -1 ? selectOptionPrompt(product, chosenVariant) : null}
          product={product}
          quantity={quantity}
          selectedVariant={chosenVariant}
        />
      )}
    </div>
  );
}
