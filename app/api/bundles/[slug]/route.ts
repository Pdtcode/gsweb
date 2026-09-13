import { NextRequest, NextResponse } from "next/server";

import { getBundleBySlug } from "@/lib/bundles";

// Bundle stock is derived from live Neon rows, so never cache this response
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const bundle = await getBundleBySlug(slug);

    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    return NextResponse.json({ bundle });
  } catch (error) {
    console.error("Failed to fetch bundle:", error);

    return NextResponse.json(
      { error: "Failed to fetch bundle" },
      { status: 500 },
    );
  }
}
