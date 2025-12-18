"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { useTheme } from "next-themes";

import { useCart } from "@/context/CartContext";
import { Product } from "@/types";

interface AddToCartButtonProps {
  product: Product;
  className?: string;
  selectedVariant?: {
    size?: string;
    color?: string;
    sku?: string;
  };
}

export const AddToCartButton = ({
  product,
  className = "",
  selectedVariant,
}: AddToCartButtonProps) => {
  const { addToCart } = useCart();
  const { theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);
    addToCart(product, 1, selectedVariant);

    // Animation effect
    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  // Check actual inventory instead of just the inStock boolean
  const getAvailableQuantity = () => {
    // If product has variants
    if (product.variants && product.variants.length > 0) {
      // If a variant is selected, find its inventory
      if (selectedVariant && (selectedVariant.size || selectedVariant.color)) {
        for (const variant of product.variants) {
          if (variant.inventory && variant.inventory.length > 0) {
            // Find matching inventory item based on selected options
            const matchingInventory = variant.inventory.find((inv) => {
              const optionLower = inv.option.toLowerCase();
              const sizeLower = selectedVariant.size?.toLowerCase() || "";
              const colorLower = selectedVariant.color?.toLowerCase() || "";

              return optionLower === sizeLower || optionLower === colorLower;
            });

            if (matchingInventory) {
              return matchingInventory.quantity;
            }
          }
        }
        return 0; // Variant selected but no inventory data found
      }

      // No variant selected, check if any variant has stock
      for (const variant of product.variants) {
        if (variant.inventory) {
          for (const inv of variant.inventory) {
            if (inv.quantity > 0) {
              return inv.quantity; // At least one variant has stock
            }
          }
        }
      }
      return 0;
    }

    // Product without variants - use totalInventory
    if (product.totalInventory !== undefined) {
      return product.totalInventory;
    }

    // Fallback to inStock boolean for products without inventory data
    return product.inStock ? 1 : 0;
  };

  const availableQuantity = getAvailableQuantity();
  const isDisabled = availableQuantity === 0;

  return (
    <Button
      className={`px-8 py-3 ${
        isDisabled
          ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
          : theme === "dark"
            ? "bg-white text-black hover:bg-gray-100"
            : "bg-black text-white hover:bg-gray-800"
      } transition-colors ${className}`}
      disabled={isDisabled}
      variant="flat"
      onClick={handleAddToCart}
    >
      {isAdding ? "Added!" : isDisabled ? "Sold Out" : "Add to Cart"}
    </Button>
  );
};
