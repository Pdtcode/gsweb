"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/context/CartContext";
import { title } from "@/components/primitives";
import { urlForImage } from "@/sanity/lib/image";
import { calculateServiceFee, formatServiceFeeDisplay, getServiceFeePercentage } from "@/lib/service-fee";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, getCartTotal } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle quantity change
  const handleQuantityChange = (productId: string, quantity: number, variantKey?: string) => {
    updateQuantity(productId, quantity, variantKey);
  };

  // Handle item removal
  const handleRemoveItem = (productId: string, variantKey?: string) => {
    removeFromCart(productId, variantKey);
  };

  // If component hasn't mounted yet, show a loading placeholder
  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  // If cart is empty, show empty state
  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className={title({ size: "lg", className: "mb-8" }).toString()}>
          Shopping Cart
        </h1>
        <div className="text-center mt-8 py-16 border border-gray-200 dark:border-gray-800 rounded-lg">
          <h2 className="text-2xl font-medium mb-4">Your cart is empty</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Looks like you haven&apos;t added any products to your cart yet.
          </p>
          <Link
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-black px-6 py-3 rounded-lg inline-block transition hover:opacity-90"
            href="/store"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className={title({ size: "lg", className: "mb-8" }).toString()}>
        Shopping Cart
      </h1>

      <div className="max-w-4xl mt-8 mx-auto">
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden mb-6">
          <div className="hidden md:grid md:grid-cols-12 p-4 bg-gray-100 dark:bg-gray-800 text-sm font-medium">
            <div className="md:col-span-6">Product</div>
            <div className="md:col-span-2 text-center">Price</div>
            <div className="md:col-span-2 text-center">Quantity</div>
            <div className="md:col-span-2 text-center">Total</div>
          </div>

          {cart.map((item) => {
            const productId = item.product.slug?.current || item.product._id;
            const variantKey = item.selectedVariant
              ? `${item.selectedVariant.size || ''}-${item.selectedVariant.color || ''}`
              : 'default';
            const uniqueKey = `${productId}-${variantKey}`;

            return (
              <div
                key={uniqueKey}
                className="border-t border-gray-200 dark:border-gray-800 p-4 md:grid md:grid-cols-12 md:items-center"
              >
                {/* Product */}
                <div className="md:col-span-6 flex items-center mb-4 md:mb-0">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                    {item.product.mainImage && (
                      <Image
                        fill
                        alt={item.product.name}
                        className="object-cover"
                        src={urlForImage(item.product.mainImage).url() || ""}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">
                      <Link
                        className="hover:underline"
                        href={`/store/products/${item.product.slug.current}`}
                      >
                        {item.product.name}
                      </Link>
                    </h3>
                    {item.selectedVariant && (item.selectedVariant.size || item.selectedVariant.color) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.selectedVariant.size && `Size: ${item.selectedVariant.size}`}
                        {item.selectedVariant.size && item.selectedVariant.color && " • "}
                        {item.selectedVariant.color && `Color: ${item.selectedVariant.color}`}
                      </p>
                    )}
                    {item.product.categories &&
                      item.product.categories.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.product.categories[0].title}
                        </p>
                      )}
                    <button
                      className="text-sm text-red-500 hover:underline mt-1"
                      onClick={() => handleRemoveItem(productId, variantKey)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="md:col-span-2 text-center mb-2 md:mb-0">
                  <span className="md:hidden inline-block w-20 font-medium">
                    Price:
                  </span>
                  <span>${item.product.price.toFixed(2)}</span>
                </div>

                {/* Quantity */}
                <div className="md:col-span-2 flex justify-center items-center mb-2 md:mb-0">
                  <span className="md:hidden inline-block w-20 font-medium">
                    Quantity:
                  </span>
                  <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded">
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() =>
                        handleQuantityChange(
                          productId,
                          item.quantity - 1,
                          variantKey
                        )
                      }
                    >
                      -
                    </button>
                    <span className="w-10 text-center">{item.quantity}</span>
                    <button
                      className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() =>
                        handleQuantityChange(
                          productId,
                          item.quantity + 1,
                          variantKey
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="md:col-span-2 text-center font-medium">
                  <span className="md:hidden inline-block w-20 font-medium">
                    Total:
                  </span>
                  <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cart Totals */}
        {(() => {
          const subtotal = getCartTotal();
          const serviceFeeCalc = calculateServiceFee(subtotal);
          const serviceFeeDisplay = formatServiceFeeDisplay(serviceFeeCalc);
          const total = subtotal + serviceFeeCalc.finalServiceFee;

          return (
            <div className="border-t border-gray-200 dark:border-gray-800 pt-6 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Service Fee ({getServiceFeePercentage()}%):</span>
                  <span>{serviceFeeDisplay.finalServiceFeeText}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold pt-2 border-t border-gray-200 dark:border-gray-800">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex justify-between items-center">
          <Link
            className="text-center text-gray-700 dark:text-gray-300 hover:underline"
            href="/store"
          >
            Continue Shopping
          </Link>

          <Link
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-black px-6 py-3 rounded-lg inline-block transition hover:opacity-90"
            href="/checkout"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
