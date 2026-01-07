import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

/**
 * API endpoint to fetch current inventory from Neon database
 * Used by Sanity Studio to display real-time inventory counts
 */

// Enable CORS for Sanity Studio
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productSlug = searchParams.get("slug");
    const sku = searchParams.get("sku");

    if (!productSlug && !sku) {
      return NextResponse.json(
        { error: "Either 'slug' or 'sku' parameter is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (sku) {
      // Get inventory for a specific SKU
      const variant = await prisma.productVariant.findFirst({
        where: { sku },
        include: {
          Product: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!variant) {
        return NextResponse.json(
          { error: `Variant with SKU ${sku} not found` },
          { status: 404, headers: corsHeaders }
        );
      }

      return NextResponse.json({
        sku: variant.sku,
        stock: variant.stock,
        size: variant.size,
        color: variant.color,
        productName: variant.Product.name,
        productSlug: variant.Product.slug,
      }, { headers: corsHeaders });
    }

    if (productSlug) {
      // Get all variants for a product
      const product = await prisma.product.findFirst({
        where: { slug: productSlug },
        include: {
          ProductVariant: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product with slug ${productSlug} not found` },
          { status: 404, headers: corsHeaders }
        );
      }

      const totalStock = product.ProductVariant.reduce(
        (sum, v) => sum + v.stock,
        0
      );

      return NextResponse.json({
        productName: product.name,
        productSlug: product.slug,
        totalStock,
        variants: product.ProductVariant.map((v) => ({
          sku: v.sku,
          stock: v.stock,
          size: v.size,
          color: v.color,
        })),
      }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error("Error fetching Neon inventory:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
