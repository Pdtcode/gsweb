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

  // Helper function to check if all required variants are selected
  const areAllVariantsSelected = () => {
    if (!product.variants || product.variants.length === 0) {
      return true; // No variants required
    }

    const requiredVariants = product.variants.map(v => v.name.toLowerCase());

    for (const variantName of requiredVariants) {
      const hasSelection = selectedVariant && (
        (variantName === 'size' && selectedVariant.size) ||
        (variantName === 'color' && selectedVariant.color)
      );

      if (!hasSelection) {
        return false; // Missing a required variant selection
      }
    }

    return true;
  };

  // Check actual inventory instead of just the inStock boolean
  const getAvailableQuantity = () => {
    // If product has variants
    if (product.variants && product.variants.length > 0) {
      // Check if all variants are selected first
      if (!areAllVariantsSelected()) {
        return -1; // Return -1 to indicate variants not selected (different from no stock)
      }

      // If a variant is selected, find its inventory
      if (selectedVariant && (selectedVariant.size || selectedVariant.color)) {
        // First, try to use real-time inventory from Neon (availableVariants)
        if (product.availableVariants && product.availableVariants.length > 0) {
          const matchingVariant = product.availableVariants.find((av: any) => {
            const sizeLower = selectedVariant.size?.toLowerCase() || "";
            const colorLower = selectedVariant.color?.toLowerCase() || "";
            const avSizeLower = av.size?.toLowerCase() || "";
            const avColorLower = av.color?.toLowerCase() || "";

            // Match based on size and color
            if (sizeLower && colorLower) {
              return avSizeLower === sizeLower && avColorLower === colorLower;
            } else if (sizeLower) {
              return avSizeLower === sizeLower;
            } else if (colorLower) {
              return avColorLower === colorLower;
            }

            return false;
          });

          if (matchingVariant) {
            return matchingVariant.stock;
          }
        }

        // Fallback to Sanity inventory data if availableVariants not present
        for (const variant of product.variants) {
          if (variant.inventory && variant.inventory.length > 0) {
            // Find matching inventory item based on selected options
            const matchingInventory = variant.inventory.find((inv) => {
              const optionLower = inv.option.toLowerCase();
              const sizeLower = selectedVariant.size?.toLowerCase() || "";
              const colorLower = selectedVariant.color?.toLowerCase() || "";

              // For products with multiple variant dimensions (e.g., Color + Size)
              // Check if the option contains all selected values
              if (sizeLower && colorLower) {
                // Both size and color selected - option must contain both
                return optionLower.includes(sizeLower) && optionLower.includes(colorLower);
              } else if (sizeLower) {
                // Only size selected
                return optionLower.includes(sizeLower);
              } else if (colorLower) {
                // Only color selected
                return optionLower.includes(colorLower);
              }

              return false;
            });

            if (matchingInventory) {
              return matchingInventory.quantity;
            }
          }
        }
        return 0; // Variant selected but no inventory data found
      }

      // No variant selected, check if any variant has stock
      // Use real-time data first
      if (product.availableVariants && product.availableVariants.length > 0) {
        const maxStock = Math.max(...product.availableVariants.map((av: any) => av.stock || 0));
        return maxStock;
      }

      // Fallback to Sanity data
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

    // Product without variants - use real-time total or fallback
    if (product.realTimeTotalInventory !== undefined) {
      return product.realTimeTotalInventory;
    }

    if (product.totalInventory !== undefined) {
      return product.totalInventory;
    }

    // Fallback to inStock boolean for products without inventory data
    return product.inStock ? 1 : 0;
  };

  const availableQuantity = getAvailableQuantity();
  const variantsNotSelected = availableQuantity === -1;
  const isDisabled = availableQuantity <= 0;

  const getButtonText = () => {
    if (isAdding) return "Added!";
    if (variantsNotSelected) return "Select Options";
    if (availableQuantity === 0) return "Sold Out";
    return "Add to Cart";
  };

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
      {getButtonText()}
    </Button>
  );
};
