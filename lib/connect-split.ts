// How a payment is split between the platform and the client. The client's
// transfer is always set, even when the service fee is $0 (e.g. a promo waives
// it): otherwise the whole payment would stay in the platform's balance.
export function connectSplitParams(
  connectedAccountId: string | undefined,
  platformFeeCents: number,
): {
  transfer_data?: { destination: string };
  application_fee_amount?: number;
} {
  if (!connectedAccountId) return {};

  return {
    transfer_data: { destination: connectedAccountId },
    ...(platformFeeCents > 0
      ? { application_fee_amount: platformFeeCents }
      : {}),
  };
}
