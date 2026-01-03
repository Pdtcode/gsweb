import { NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        ProductVariant: true,
      },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      count: products.length,
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        variants: product.ProductVariant.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock: variant.stock
        }))
      }))
    });

  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}