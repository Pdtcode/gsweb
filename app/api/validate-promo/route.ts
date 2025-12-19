import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import { promoCodeByCodeQuery } from "@/lib/queries";

interface PromoCode {
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
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { code, orderTotal } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    // Fetch promo code from Sanity
    const promo: PromoCode = await client.fetch(promoCodeByCodeQuery, {
      code: code.toUpperCase()
    });

    if (!promo) {
      return NextResponse.json(
        { error: "Invalid promo code" },
        { status: 404 }
      );
    }

    if (!promo.isActive) {
      return NextResponse.json(
        { error: "This promo code is no longer active" },
        { status: 400 }
      );
    }

    // Check if promo code is still valid based on dates
    if (promo.validFrom && new Date() < new Date(promo.validFrom)) {
      return NextResponse.json(
        { error: "This promo code is not yet active" },
        { status: 400 }
      );
    }

    if (promo.validUntil && new Date() > new Date(promo.validUntil)) {
      return NextResponse.json(
        { error: "This promo code has expired" },
        { status: 400 }
      );
    }

    // Check minimum order amount
    if (promo.minOrderAmount && orderTotal < promo.minOrderAmount) {
      return NextResponse.json(
        {
          error: `Minimum order amount of $${promo.minOrderAmount} required for this promo code`
        },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promo.usageLimit && promo.usedCount && promo.usedCount >= promo.usageLimit) {
      return NextResponse.json(
        { error: "This promo code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.type === "percentage") {
      discountAmount = (orderTotal * promo.value) / 100;
      if (promo.maxDiscount) {
        discountAmount = Math.min(discountAmount, promo.maxDiscount);
      }
    } else if (promo.type === "fixed") {
      discountAmount = promo.value;
    } else if (promo.type === "freeShipping") {
      // Free shipping - in this case, you might want to handle shipping costs
      discountAmount = 0; // or whatever your shipping cost is
    }

    return NextResponse.json({
      valid: true,
      discount: {
        code: promo.code,
        type: promo.type === "freeShipping" ? "fixed" : promo.type,
        value: promo.value,
        description: promo.description,
        discountAmount: discountAmount,
      }
    });

  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}