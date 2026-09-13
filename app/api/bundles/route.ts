import { NextResponse } from "next/server";

import { getActiveBundles } from "@/lib/bundles";

// Bundle stock is derived from live Neon rows, so never cache this response
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bundles = await getActiveBundles();

    return NextResponse.json({ bundles });
  } catch (error) {
    console.error("Failed to fetch bundles:", error);

    return NextResponse.json(
      { error: "Failed to fetch bundles" },
      { status: 500 },
    );
  }
}
