import { NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function GET() {
  try {
    // Fetch all products with their variants and SKUs
    const products = await prisma.product.findMany({
      include: {
        ProductVariant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stock: true,
          },
        },
      },
      where: {
        inStock: true, // Only include products that are in stock
      },
    });

    // Transform the data to a more convenient format
    const productSkus = products.map((product) => ({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variants: product.ProductVariant.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
      })),
    }));

    // Also create a flat SKU lookup map for easy access
    const skuLookup: Record<string, { productId: string; productName: string; variantId: string; size: string; color: string | null; stock: number }> = {};

    products.forEach((product) => {
      product.ProductVariant.forEach((variant) => {
        if (variant.sku) {
          skuLookup[variant.sku] = {
            productId: product.id,
            productName: product.name,
            variantId: variant.id,
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          };
        }
      });
    });

    return NextResponse.json({
      products: productSkus,
      skuLookup,
      totalProducts: products.length,
      totalVariants: products.reduce((sum, p) => sum + p.ProductVariant.length, 0),
    });
  } catch (error) {
    console.error("Error fetching product SKUs:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch product SKUs",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}