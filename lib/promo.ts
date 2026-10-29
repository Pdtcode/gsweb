// Promo code rules, shared by /api/validate-promo (the preview shown when a
// customer applies a code) and /api/create-payment-intent (the amount actually
// charged). Keeping one copy means the two can't drift apart. Pure — no server
// imports — so the checkout page could use it too.

export interface PromoCode {
  _id: string;
  code: string;
  title: string;
  description: string;
  type: "percentage" | "fixed" | "freeShipping";
  value: number;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  customerLimit?: number;
  applicableProducts?: Array<{ _id: string; name: string; slug: string }>;
  applicableCategories?: Array<{ _id: string; title: string; slug: string }>;
  discountsServiceFee?: boolean;
  serviceFeeDiscountType?: "percentage" | "fixed";
  serviceFeeDiscountValue?: number;
  notes?: string;
}

export interface PromoServiceFeeDiscount {
  type: "percentage" | "fixed";
  value: number;
}

export type PromoEvaluation =
  | {
      ok: true;
      discountAmount: number;
      serviceFeeDiscount: PromoServiceFeeDiscount | null;
    }
  | { ok: false; error: string };

/**
 * Checks a promo code against an order and works out its discount.
 *
 * `orderTotal` is the items subtotal (after bundle pricing, before the Spend &
 * Save discount, fees and shipping) — the same figure the checkout page passes
 * to /api/validate-promo.
 */
export function evaluatePromo(
  promo: PromoCode | null,
  orderTotal: number,
  now: Date = new Date(),
): PromoEvaluation {
  if (!promo) return { ok: false, error: "Invalid promo code" };

  if (!promo.isActive) {
    return { ok: false, error: "This promo code is no longer active" };
  }

  if (promo.validFrom && now < new Date(promo.validFrom)) {
    return { ok: false, error: "This promo code is not yet active" };
  }

  if (promo.validUntil && now > new Date(promo.validUntil)) {
    return { ok: false, error: "This promo code has expired" };
  }

  if (promo.minOrderAmount && orderTotal < promo.minOrderAmount) {
    return {
      ok: false,
      error: `Minimum order amount of $${promo.minOrderAmount} required for this promo code`,
    };
  }

  if (promo.usageLimit && promo.usedCount && promo.usedCount >= promo.usageLimit) {
    return { ok: false, error: "This promo code has reached its usage limit" };
  }

  let discountAmount = 0;

  if (promo.type === "percentage") {
    discountAmount = (orderTotal * promo.value) / 100;
    if (promo.maxDiscount) {
      discountAmount = Math.min(discountAmount, promo.maxDiscount);
    }
  } else if (promo.type === "fixed") {
    discountAmount = promo.value;
  }
  // "freeShipping" carries no item discount — shipping is not charged today.

  // A code can never take the items below zero; the remainder would otherwise
  // eat into the service fee.
  discountAmount = Math.max(0, Math.min(discountAmount, orderTotal));

  const serviceFeeDiscount =
    promo.discountsServiceFee &&
    promo.serviceFeeDiscountType &&
    promo.serviceFeeDiscountValue !== undefined
      ? { type: promo.serviceFeeDiscountType, value: promo.serviceFeeDiscountValue }
      : null;

  return { ok: true, discountAmount, serviceFeeDiscount };
}
