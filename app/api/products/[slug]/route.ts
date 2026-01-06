import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import { productBySlugQuery } from "@/lib/queries";
import prisma from "@/lib/prismaClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get product info from Sanity
    const sanityProduct = await client.fetch(productBySlugQuery, { slug });

    if (!sanityProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get real-time inventory from PostgreSQL
    const pgProduct = await prisma.product.findFirst({
      where: { slug },
      include: {
        ProductVariant: true,
      },
    });

    if (pgProduct) {
      // Merge Sanity product data with real-time inventory
      const enhancedProduct = {
        ...sanityProduct,
        // Update variants with real PostgreSQL stock levels
        variants: sanityProduct.variants?.map((sanityVariant: any) => {
          // Find matching PostgreSQL variant by size/color or SKU
          const pgVariant = pgProduct.ProductVariant.find((pv) => {
            // Try to match by size and color
            if (sanityVariant.name === "Color" && sanityVariant.options) {
              return sanityVariant.options.some((option: string) => {
                const parts = option.split(" ");
                if (parts.length >= 2) {
                  const color = parts[0];
                  const size = parts.slice(1).join(" ");
                  return pv.color === color && pv.size === size;
                }
                return false;
              });
            }
            // Try to match by size only
            if (sanityVariant.name === "Size" && sanityVariant.options) {
              return sanityVariant.options.some((size: string) =>
                pv.size === size && pv.color === "Size"
              );
            }
            return false;
          });

          // Return variant with updated stock info
          return {
            ...sanityVariant,
            // Add real-time inventory data
            realTimeInventory: pgVariant ? {
              stock: pgVariant.stock,
              sku: pgVariant.sku,
              id: pgVariant.id
            } : null
          };
        }),
        // Calculate total available inventory from PostgreSQL
        realTimeTotalInventory: pgProduct.ProductVariant.reduce(
          (total, variant) => total + variant.stock,
          0
        ),
        // Update inStock based on real inventory
        realTimeInStock: pgProduct.ProductVariant.some(variant => variant.stock > 0),
        // Add individual variant details for frontend
        availableVariants: pgProduct.ProductVariant.map(variant => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          stock: variant.stock,
          price: pgProduct.price
        }))
      };

      return NextResponse.json(enhancedProduct, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    } else {
      // If no PostgreSQL data found, return Sanity data as-is
      return NextResponse.json(sanityProduct, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}