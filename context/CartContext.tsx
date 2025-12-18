"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

import { Product } from "@/types";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: {
    size?: string;
    color?: string;
    sku?: string;
  };
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, selectedVariant?: { size?: string; color?: string; sku?: string }) => void;
  removeFromCart: (productId: string, variantKey?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantKey?: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemsCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from localStorage on initial render
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");

    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error("Failed to parse cart from localStorage:", error);
        localStorage.removeItem("cart");
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Helper function to get available inventory for a product/variant
  const getAvailableInventory = (product: Product, selectedVariant?: { size?: string; color?: string; sku?: string }) => {
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

      // No variant selected, return highest quantity from any variant
      let maxQuantity = 0;
      for (const variant of product.variants) {
        if (variant.inventory) {
          for (const inv of variant.inventory) {
            maxQuantity = Math.max(maxQuantity, inv.quantity);
          }
        }
      }
      return maxQuantity;
    }

    // Product without variants - use totalInventory
    if (product.totalInventory !== undefined) {
      return product.totalInventory;
    }

    // Fallback to unlimited if no inventory data (for backward compatibility)
    return 999;
  };

  const addToCart = (product: Product, quantity = 1, selectedVariant?: { size?: string; color?: string; sku?: string }) => {
    // Get Sanity ID for the product
    const productId = product.slug?.current || product._id;

    // Create a unique key for this variant combination
    const variantKey = selectedVariant
      ? `${selectedVariant.size || ''}-${selectedVariant.color || ''}`
      : 'default';

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (item) => {
          const itemId = item.product.slug?.current || item.product._id;
          const itemVariantKey = item.selectedVariant
            ? `${item.selectedVariant.size || ''}-${item.selectedVariant.color || ''}`
            : 'default';
          return itemId === productId && itemVariantKey === variantKey;
        }
      );

      // Check available inventory
      const availableInventory = getAvailableInventory(product, selectedVariant);
      const currentQuantityInCart = existingItemIndex >= 0 ? prevCart[existingItemIndex].quantity : 0;
      const newTotalQuantity = currentQuantityInCart + quantity;

      // Prevent adding more than available inventory
      if (newTotalQuantity > availableInventory) {
        console.warn(`Cannot add ${quantity} items. Only ${availableInventory - currentQuantityInCart} available.`);

        // If there's still room, add what we can
        if (currentQuantityInCart < availableInventory) {
          quantity = availableInventory - currentQuantityInCart;
        } else {
          // Already at max, don't add anything
          return prevCart;
        }
      }

      if (existingItemIndex >= 0) {
        // If product with same variant already exists in cart, increase quantity
        const updatedCart = [...prevCart];

        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: updatedCart[existingItemIndex].quantity + quantity,
        };

        return updatedCart;
      } else {
        // Add new product to cart with selected variant
        return [...prevCart, { product, quantity, selectedVariant }];
      }
    });
  };

  const removeFromCart = (productId: string, variantKey?: string) => {
    setCart((prevCart) =>
      prevCart.filter(
        (item) => {
          const itemId = item.product.slug?.current || item.product._id;
          if (itemId !== productId) return true;

          // If variantKey is provided, only remove that specific variant
          if (variantKey) {
            const itemVariantKey = item.selectedVariant
              ? `${item.selectedVariant.size || ''}-${item.selectedVariant.color || ''}`
              : 'default';
            return itemVariantKey !== variantKey;
          }

          // If no variantKey, remove all variants of this product
          return false;
        }
      ),
    );
  };

  const updateQuantity = (productId: string, quantity: number, variantKey?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantKey);

      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        const itemId = item.product.slug?.current || item.product._id;
        if (itemId !== productId) return item;

        // Check if this is the item we're updating
        const shouldUpdate = variantKey
          ? (() => {
              const itemVariantKey = item.selectedVariant
                ? `${item.selectedVariant.size || ''}-${item.selectedVariant.color || ''}`
                : 'default';
              return itemVariantKey === variantKey;
            })()
          : true;

        if (!shouldUpdate) return item;

        // Validate against available inventory
        const availableInventory = getAvailableInventory(item.product, item.selectedVariant);

        // Cap quantity at available inventory
        const validatedQuantity = Math.min(quantity, availableInventory);

        if (validatedQuantity < quantity) {
          console.warn(`Cannot set quantity to ${quantity}. Only ${availableInventory} available. Setting to ${validatedQuantity}.`);
        }

        return { ...item, quantity: validatedQuantity };
      }),
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      return total + item.product.price * item.quantity;
    }, 0);
  };

  const getCartItemsCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartItemsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
}
