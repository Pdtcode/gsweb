interface ServiceFeeDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface ServiceFeeCalculation {
  baseServiceFee: number;
  serviceFeeDiscount: number;
  finalServiceFee: number;
  discountApplied: boolean;
}

const SERVICE_FEE_PERCENTAGE = 0.05; // 5%

export function calculateServiceFee(
  subtotal: number,
  serviceFeeDiscount?: ServiceFeeDiscount
): ServiceFeeCalculation {
  const baseServiceFee = subtotal * SERVICE_FEE_PERCENTAGE;

  let serviceFeeDiscountAmount = 0;

  if (serviceFeeDiscount) {
    if (serviceFeeDiscount.type === 'percentage') {
      serviceFeeDiscountAmount = (baseServiceFee * serviceFeeDiscount.value) / 100;
    } else if (serviceFeeDiscount.type === 'fixed') {
      serviceFeeDiscountAmount = Math.min(serviceFeeDiscount.value, baseServiceFee);
    }
  }

  const finalServiceFee = Math.max(0, baseServiceFee - serviceFeeDiscountAmount);

  return {
    baseServiceFee,
    serviceFeeDiscount: serviceFeeDiscountAmount,
    finalServiceFee,
    discountApplied: serviceFeeDiscountAmount > 0
  };
}

export function formatServiceFeeDisplay(calculation: ServiceFeeCalculation): {
  baseServiceFeeText: string;
  serviceFeeDiscountText?: string;
  finalServiceFeeText: string;
} {
  return {
    baseServiceFeeText: `$${calculation.baseServiceFee.toFixed(2)}`,
    serviceFeeDiscountText: calculation.discountApplied
      ? `-$${calculation.serviceFeeDiscount.toFixed(2)}`
      : undefined,
    finalServiceFeeText: `$${calculation.finalServiceFee.toFixed(2)}`
  };
}

export function getServiceFeePercentage(): number {
  return SERVICE_FEE_PERCENTAGE * 100; // Return as percentage for display (5)
}