import { NextResponse } from "next/server";

import { getSpendCampaign } from "@/lib/spend-campaign-server";

// The checkout page reads the live campaign from here to preview the discount.
// The payment-intent route re-reads it itself, so this is display-only.
export const dynamic = "force-dynamic";

export async function GET() {
  const campaign = await getSpendCampaign({ fresh: true });

  return NextResponse.json({ campaign }, { headers: { "Cache-Control": "no-store" } });
}
