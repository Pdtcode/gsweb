"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { useTheme } from "next-themes";

import { useCart } from "@/context/CartContext";
import { Product } from "@/types";
import {
  availableQuantityFor,
  selectOptionPrompt,
  type SelectedVariant,
} from "@/lib/product-stock";

interface AddToCartButtonProps {
  product: Product;
  className?: string;
  quantity?: number;
  selectedVariant?: SelectedVariant;
  onAdded?: () => void;
}

export const AddToCartButton = ({
  product,
  className = "",
  quantity = 1,
  selectedVariant,
  onAdded,
}: AddToCartButtonProps) => {
  const { addToCart } = useCart();
  const { theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);
    addToCart(product, quantity, selectedVariant);
    onAdded?.();

    // Animation effect
    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  const availableQuantity = availableQuantityFor(product, selectedVariant);
  const variantsNotSelected = availableQuantity === -1;
  const isDisabled = availableQuantity <= 0;
  const getButtonText = () => {
    if (isAdding) return "Added!";
    if (variantsNotSelected) return selectOptionPrompt(product, selectedVariant);
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
