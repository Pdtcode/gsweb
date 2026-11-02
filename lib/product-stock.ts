import { Product } from "@/types";

export interface SelectedVariant {
  size?: string;
  color?: string;
  sku?: string;
}

// Helper function to check if all required variants are selected
function areAllVariantsSelected(product: Product, selectedVariant?: SelectedVariant) {
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
}

// How many can be bought of the current choice, from real stock rather than the
// inStock boolean. -1 means options still need choosing.
export function availableQuantityFor(product: Product, selectedVariant?: SelectedVariant) {
  // If product has variants
  if (product.variants && product.variants.length > 0) {
    // Check if all variants are selected first
    if (!areAllVariantsSelected(product, selectedVariant)) {
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
}

// Names what's still missing, e.g. "Select a size"
export function selectOptionPrompt(product: Product, selectedVariant?: SelectedVariant) {
  const missing = product.variants?.find((variant) => {
    const name = variant.name.toLowerCase();

    if (name === "size") return !selectedVariant?.size;
    if (name === "color") return !selectedVariant?.color;

    return true;
  });

  return missing ? `Select a ${missing.name.toLowerCase()}` : "Select options";
}
