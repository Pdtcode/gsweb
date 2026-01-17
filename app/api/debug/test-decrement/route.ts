import { NextResponse } from "next/server";
import prisma from "@/lib/prismaClient";

export async function POST() {
  try {
    const orderId = "7540bf33-d2a4-4663-a92b-0b6fa7ea98b9";
    const variantId = "ec429909-2823-4c82-b363-55ee61dfb750";

    console.log("=== MANUAL DECREMENT TEST ===");

    // Get current stock
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    console.log(`Current stock for ${variant.sku}: ${variant.stock}`);

    // Decrement by 1
    const newStock = Math.max(0, variant.stock - 1);

    const updatedVariant = await prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: newStock }
    });

    console.log(`Updated stock for ${variant.sku}: ${updatedVariant.stock}`);

    return NextResponse.json({
      success: true,
      sku: variant.sku,
      oldStock: variant.stock,
      newStock: updatedVariant.stock,
      decremented: 1,
      message: `Successfully decremented stock for ${variant.sku} from ${variant.stock} to ${updatedVariant.stock}`
    });

  } catch (error) {
    console.error("Manual decrement test error:", error);
    return NextResponse.json(
      {
        error: "Manual decrement failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}