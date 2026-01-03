import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import { promoCodeByCodeQuery } from "@/lib/queries";
import { rateLimiter, getRealIP, createSecureIdentifier, validatePromoCodeFormat } from "@/lib/rate-limit";

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
    const { code, orderTotal, userId } = await request.json();

    // Get client information for security tracking
    const ip = getRealIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const identifier = createSecureIdentifier(ip, userAgent);

    // Basic validation
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    // Validate promo code format to prevent injection attempts
    if (!validatePromoCodeFormat(code)) {
      // Log suspicious activity but don't reveal specific validation rules
      console.warn(`Suspicious promo code format from ${ip}: ${code}`);
      return NextResponse.json(
        { error: "Invalid promo code format" },
        { status: 400 }
      );
    }

    // Check rate limiting (max 5 attempts per minute per identifier)
    const rateLimitResult = rateLimiter.isRateLimited(identifier, 5, 60000);
    if (rateLimitResult.limited) {
      const resetTime = new Date(rateLimitResult.resetTime || 0).toLocaleTimeString();
      return NextResponse.json(
        {
          error: `Too many attempts. Try again after ${resetTime}`,
          rateLimited: true,
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 }
      );
    }

    // Check brute force protection
    const bruteForceResult = rateLimiter.checkBruteForce(identifier, false);
    if (bruteForceResult.blocked) {
      const blockedUntil = new Date(bruteForceResult.blockedUntil || 0);
      return NextResponse.json(
        {
          error: `Account temporarily blocked due to suspicious activity. Try again after ${blockedUntil.toLocaleString()}`,
          blocked: true,
          blockedUntil: bruteForceResult.blockedUntil
        },
        { status: 423 }
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

    // Reset brute force counter on successful validation
    rateLimiter.checkBruteForce(identifier, true);

    // Log successful validation for audit purposes
    const auditData = {
      promoCodeId: promo._id,
      code: promo.code,
      userId: userId || 'anonymous',
      userIP: ip,
      userAgent: userAgent,
      orderTotal,
      discountAmount,
      timestamp: new Date().toISOString(),
      action: 'validated'
    };

    // TODO: Create promo usage record in Sanity when permissions are fixed
    // Currently disabled due to Sanity API token lacking create permissions
    try {
      console.log('Promo usage tracking - would log:', {
        promoCode: promo.code,
        userId: userId || `anonymous_${identifier}`,
        userIP: ip,
        discountAmount
      });
    } catch (auditError) {
      // Don't fail the validation if audit logging fails
      console.error('Failed to create promo usage record:', auditError);
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