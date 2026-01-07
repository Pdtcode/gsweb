import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Debug endpoint to list all products in Neon
 */
export async function GET(req: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        ProductVariant: {
          select: {
            sku: true,
            stock: true,
            size: true,
            color: true,
          },
        },
      },
      take: 50,
    });

    return NextResponse.json(
      {
        count: products.length,
        products: products.map((p) => ({
          name: p.name,
          slug: p.slug,
          totalStock: p.ProductVariant.reduce((sum, v) => sum + v.stock, 0),
          variantCount: p.ProductVariant.length,
        })),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch products",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
