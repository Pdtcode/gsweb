"use client";

import { Product, InventoryItem } from "@/types";

interface InventoryDisplayProps {
  product: Product;
  selectedVariant?: {
    size?: string;
    color?: string;
  };
}

export function InventoryDisplay({ product, selectedVariant }: InventoryDisplayProps) {
  // Helper function to check if all required variants are selected
  const areAllVariantsSelected = () => {
    if (!product.variants || product.variants.length === 0) {
      return true; // No variants required, so consider all selected
    }

    // Get all variant names that need to be selected
    const requiredVariants = product.variants.map(v => v.name.toLowerCase());

    // Check if we have a selection for each required variant
    for (const variantName of requiredVariants) {
      const hasSelection = selectedVariant && (
        (variantName === 'size' && selectedVariant.size) ||
        (variantName === 'color' && selectedVariant.color) ||
        // Handle any other variant names by checking if they exist in a more generic way
        Object.keys(selectedVariant).some(key => key.toLowerCase() === variantName)
      );

      if (!hasSelection) {
        return false;
      }
    }

    return true;
  };

  // Calculate inventory based on whether product has variants
  const getInventoryInfo = () => {
    // If product has variants but not all are selected, don't show inventory
    if (product.variants && product.variants.length > 0 && !areAllVariantsSelected()) {
      return null;
    }

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

              // For products with multiple variant dimensions (e.g., Color + Size)
              // Check if the option contains all selected values
              // Handles formats like "White Small", "Small-White", "White/Small", etc.
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
              return {
                quantity: matchingInventory.quantity,
                lowStockThreshold: matchingInventory.lowStockThreshold || product.lowStockAlert || 5,
                sku: matchingInventory.sku,
              };
            }
          }
        }
        return null; // Variant selected but no inventory data found
      }

      return null; // Should not reach here given the areAllVariantsSelected check above
    }

    // Product without variants - use totalInventory
    if (product.totalInventory !== undefined) {
      return {
        quantity: product.totalInventory,
        lowStockThreshold: product.lowStockAlert || 5,
        sku: product.sku,
      };
    }

    return null;
  };

  const inventoryInfo = getInventoryInfo();

  // If no inventory info and product has variants, show selection prompt
  if (!inventoryInfo && product.variants && product.variants.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Availability:</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Please select all options to view availability
          </span>
        </div>
      </div>
    );
  }

  if (!inventoryInfo) {
    return null;
  }

  const isLowStock = inventoryInfo.quantity <= inventoryInfo.lowStockThreshold && inventoryInfo.quantity > 0;
  const isOutOfStock = inventoryInfo.quantity === 0;

  return (
    <div className="space-y-2">
      {/* Inventory Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Availability:</span>
        {isOutOfStock ? (
          <span className="text-sm text-red-600 dark:text-red-400 font-medium">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            Low Stock - Only {inventoryInfo.quantity} left!
          </span>
        ) : (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            {inventoryInfo.quantity} in stock
          </span>
        )}
      </div>

      {/* SKU */}
      {inventoryInfo.sku && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            SKU: {inventoryInfo.sku}
          </span>
        </div>
      )}

    </div>
  );
}
