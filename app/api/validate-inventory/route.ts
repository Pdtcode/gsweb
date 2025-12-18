import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid request: items array is required" },
        { status: 400 }
      );
    }

    const validationResults = [];
    let allAvailable = true;

    for (const item of items) {
      const { productId, variantId, quantity } = item;

      if (!variantId) {
        // If no variant, we can't validate stock in the current system
        validationResults.push({
          productId,
          variantId: null,
          requestedQuantity: quantity,
          available: true,
          message: "Product has no variants, validation skipped",
        });
        continue;
      }

      // Get the current stock for this variant
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          Product: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!variant) {
        validationResults.push({
          productId,
          variantId,
          requestedQuantity: quantity,
          available: false,
          message: "Product variant not found",
        });
        allAvailable = false;
        continue;
      }

      const isAvailable = variant.stock >= quantity;

      validationResults.push({
        productId,
        productName: variant.Product.name,
        variantId,
        variantSku: variant.sku,
        variantSize: variant.size,
        variantColor: variant.color,
        requestedQuantity: quantity,
        availableStock: variant.stock,
        available: isAvailable,
        message: isAvailable
          ? "In stock"
          : `Only ${variant.stock} units available, you requested ${quantity}`,
      });

      if (!isAvailable) {
        allAvailable = false;
      }
    }

    return NextResponse.json({
      valid: allAvailable,
      items: validationResults,
    });
  } catch (error) {
    console.error("Error validating inventory:", error);
    return NextResponse.json(
      { error: "Failed to validate inventory" },
      { status: 500 }
    );
  }
}
