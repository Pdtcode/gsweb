"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { useTheme } from "next-themes";

import { useCart } from "@/context/CartContext";
import { Product } from "@/types";

interface AddToCartButtonProps {
  product: Product;
  className?: string;
}

export const AddToCartButton = ({
  product,
  className = "",
}: AddToCartButtonProps) => {
  const { addToCart } = useCart();
  const { theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);
    addToCart(product, 1);

    // Animation effect
    setTimeout(() => {
      setIsAdding(false);
    }, 1000);
  };

  // Disable button if product is out of stock
  const isDisabled = !product.inStock;

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
