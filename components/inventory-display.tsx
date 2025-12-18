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
  // Calculate inventory based on whether product has variants
  const getInventoryInfo = () => {
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

      // No variant selected, show total across all variants
      let totalQuantity = 0;
      for (const variant of product.variants) {
        if (variant.inventory) {
          totalQuantity += variant.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
        }
      }

      if (totalQuantity > 0) {
        return {
          quantity: totalQuantity,
          lowStockThreshold: product.lowStockAlert || 5,
          isTotal: true,
        };
      }

      return null;
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
            {inventoryInfo.isTotal
              ? `${inventoryInfo.quantity} total in stock`
              : `${inventoryInfo.quantity} in stock`
            }
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

      {/* Variant Selection Note */}
      {product.variants && product.variants.length > 0 && !selectedVariant?.size && !selectedVariant?.color && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          Select a variant to see specific availability
        </p>
      )}
    </div>
  );
}
