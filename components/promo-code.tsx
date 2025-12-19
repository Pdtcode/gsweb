"use client";

import { useState } from "react";

interface PromoCodeProps {
  onPromoApplied: (discount: DiscountInfo) => void;
  onPromoRemoved: () => void;
  appliedPromo?: DiscountInfo;
  orderTotal: number;
  userId?: string;
}

export interface DiscountInfo {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  description: string;
  discountAmount?: number;
}

export function PromoCode({ onPromoApplied, onPromoRemoved, appliedPromo, orderTotal, userId }: PromoCodeProps) {
  const [promoCode, setPromoCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");

  const validatePromoCode = async (code: string): Promise<DiscountInfo | null> => {
    try {
      const response = await fetch("/api/validate-promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
          orderTotal: orderTotal,
          userId: userId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.discount;
      } else {
        const errorData = await response.json();

        // Handle specific security error types
        if (response.status === 429 && errorData.rateLimited) {
          throw new Error(errorData.error || "Too many attempts. Please wait before trying again.");
        } else if (response.status === 423 && errorData.blocked) {
          throw new Error(errorData.error || "Account temporarily blocked. Please try again later.");
        } else {
          throw new Error(errorData.error || "Invalid promo code");
        }
      }
    } catch (err) {
      throw err;
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setError("Please enter a promo code");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const discount = await validatePromoCode(promoCode.trim());

      if (discount) {
        onPromoApplied(discount);
        setPromoCode("");
      } else {
        setError("Invalid promo code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to validate promo code. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemovePromo = () => {
    onPromoRemoved();
    setError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApplyPromo();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Promo Code</h3>

      {appliedPromo ? (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                {appliedPromo.code} Applied
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {appliedPromo.description}
              </p>
            </div>
            <button
              onClick={handleRemovePromo}
              className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter promo code"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isValidating}
            />
            <button
              onClick={handleApplyPromo}
              disabled={isValidating || !promoCode.trim()}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-black rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isValidating ? "Applying..." : "Apply"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

        </div>
      )}
    </div>
  );
}