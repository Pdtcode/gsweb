"use client";

import { useEffect, useState } from "react";

import { ExpressCheckout } from "@/components/express-checkout";
import { useAuth } from "@/context/AuthContext";
import { requestPayment } from "@/lib/checkout-payment";
import type { CustomerDetails } from "@/lib/express-checkout-details";
import type { SelectedVariant } from "@/lib/product-stock";
import { calculateServiceFee } from "@/lib/service-fee";
import { getSpendDiscount, type SpendCampaign } from "@/lib/spend-campaign";
import { Product } from "@/types";

const ignoreSettled = () => {};

// Apple Pay / Google Pay on a product page: buys just this item, shipped, without
// touching the cart. Charged the same as checkout: 5% fee and any Spend & Save tier.
export function ProductExpressCheckout({
  product,
  quantity,
  selectedVariant,
  optionPrompt,
}: {
  product: Product;
  quantity: number;
  selectedVariant?: SelectedVariant;
  // What the customer still has to choose, e.g. "Select a size"
  optionPrompt: string | null;
}) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<SpendCampaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCampaign = async () => {
    const res = await fetch("/api/spend-campaign").catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;

    setCampaign(data?.campaign ?? null);
  };

  useEffect(() => {
    loadCampaign();
  }, []);

  // A choice made after the prompt clears it
  useEffect(() => {
    setError(null);
  }, [optionPrompt, quantity]);

  const subtotal = product.price * quantity;
  const fee = calculateServiceFee(subtotal).finalServiceFee;
  const total =
    Math.max(0, subtotal - getSpendDiscount(subtotal, campaign).discount) + fee;
  const totalCents = Math.round(total * 100);
  const feeCents = Math.min(totalCents, Math.round(fee * 100));

  const createPayment = async (
    details: CustomerDetails,
  ): Promise<string | null> => {
    const { response, result } = await requestPayment({
      items: [{ product, quantity, selectedVariant }],
      details,
      deliveryMethod: "shipping",
      expectedTotal: total,
      user,
    });

    // Nothing has been charged. Show the new total rather than charging it unseen.
    if (response.status === 409 && result?.totalChanged) {
      await loadCampaign();
      setError(
        `The total has changed to $${Number(result.total).toFixed(2)} because a price or offer changed. Please refresh the page and try again.`,
      );

      return null;
    }

    if (!response.ok || !result?.clientSecret) {
      setError(
        result?.error || "We couldn't start your payment. Please try again.",
      );

      return null;
    }

    return result.clientSecret as string;
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className={optionPrompt ? "opacity-50" : undefined}>
          <ExpressCheckout
            standalone
            allowedCountries={["US", "CA"]}
            createPayment={createPayment}
            feeCents={feeCents}
            itemsCents={totalCents - feeCents}
            needsShippingAddress={true}
            totalCents={totalCents}
            onError={setError}
            onPaid={(paymentIntentId) => {
              window.location.href = `/order/success?payment_intent=${paymentIntentId}`;
            }}
            onSettled={ignoreSettled}
          />
        </div>
        {/* Stripe can't stop a wallet opening once tapped, so taps are caught until
            the options are chosen. Has no height when no wallet is showing. */}
        {optionPrompt && (
          <button
            aria-label={optionPrompt}
            className="absolute inset-0 z-10"
            type="button"
            onClick={() => setError(`${optionPrompt} first.`)}
          />
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
