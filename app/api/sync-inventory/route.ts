import { NextRequest, NextResponse } from "next/server";

import { syncProductsFromSanity } from "@/lib/productSync";

// Manual Sanity → Neon product sync. Day to day this happens automatically via
// the Sanity product webhook (app/api/sanity-webhook); this endpoint is kept
// for one-off full re-syncs.

// CORS headers for Sanity Studio
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();

    // If productId is provided, sync only that product; otherwise sync all
    const results = await syncProductsFromSanity(productId);

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No products found in Sanity" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      message: "Inventory sync completed",
      results,
      totalProcessed: results.length,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error syncing inventory:", error);
    return NextResponse.json(
      { error: "Failed to sync inventory", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
