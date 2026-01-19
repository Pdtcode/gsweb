import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import prisma from "@/lib/prismaClient";
import crypto from "crypto";

// Use the API_SYNC_KEY from your .env file
const WEBHOOK_SECRET = process.env.API_SYNC_KEY;

interface SanityWebhookPayload {
  _type: string;
  _id: string;
  _rev?: string;
  projectId: string;
  dataset: string;
  transition?: string;
}

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("No API_SYNC_KEY configured - skipping signature verification");
    return true; // Allow in development, but log warning
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-sanity-signature");

    // Verify webhook signature for security
    if (signature && !verifySignature(body, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: SanityWebhookPayload = JSON.parse(body);

    console.log("=== Sanity Webhook Received ===");
    console.log("Document type:", payload._type);
    console.log("Document ID:", payload._id);

    // Only process product-related documents
    if (payload._type === "product") {
      console.log("Processing product update...");

      // Trigger product sync
      await syncProductsFromSanity();

      console.log("Product sync completed via webhook");

      return NextResponse.json({
        success: true,
        message: "Products synced successfully"
      });
    }

    // For other document types, just acknowledge
    return NextResponse.json({
      success: true,
      message: "Webhook received but no action needed"
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Reuse your existing sync logic
async function syncProductsFromSanity() {
  console.log("Starting product sync from Sanity...");

  const sanityProducts = await client.fetch(`
    *[_type == "product"] {
      _id,
      name,
      slug,
      price,
      description,
      images[] {
        asset->{
          _id,
          url
        }
      },
      variants[] {
        _key,
        title,
        price,
        inventory[] {
          _key,
          option,
          quantity,
          sku
        }
      },
      category->{
        title
      }
    }
  `);

  console.log(`Found ${sanityProducts.length} products in Sanity`);

  for (const sanityProduct of sanityProducts) {
    try {
      // Check if product exists
      const existingProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { id: sanityProduct._id },
            { slug: sanityProduct.slug?.current }
          ]
        },
        include: { ProductVariant: true }
      });

      const productData = {
        name: sanityProduct.name || "Unnamed Product",
        description: sanityProduct.description || "",
        price: sanityProduct.price || 0,
        slug: sanityProduct.slug?.current || `product-${sanityProduct._id}`,
        images: sanityProduct.images?.map((img: any) => img.asset?.url).filter(Boolean) || [],
        category: sanityProduct.category?.title || null,
        inStock: true,
      };

      let product;
      if (existingProduct) {
        // Update existing product
        product = await prisma.product.update({
          where: { id: existingProduct.id },
          data: productData,
          include: { ProductVariant: true }
        });
        console.log(`Updated product: ${product.name}`);
      } else {
        // Create new product
        product = await prisma.product.create({
          data: {
            ...productData,
            id: sanityProduct._id,
          },
          include: { ProductVariant: true }
        });
        console.log(`Created product: ${product.name}`);
      }

      // Sync variants
      if (sanityProduct.variants && sanityProduct.variants.length > 0) {
        for (const variant of sanityProduct.variants) {
          if (!variant.inventory || variant.inventory.length === 0) continue;

          for (const inventoryItem of variant.inventory) {
            const sku = inventoryItem.sku || `${sanityProduct.slug?.current}-${inventoryItem.option}`;
            const quantity = inventoryItem.quantity || 0;

            // Parse size and color from option
            const option = inventoryItem.option || "";
            const [size, color] = option.includes(" ") ? option.split(" ", 2) : [option, "Size"];

            const existingVariant = await prisma.productVariant.findFirst({
              where: {
                OR: [
                  { sku: sku },
                  {
                    AND: [
                      { productId: product.id },
                      { size: size },
                      { color: color }
                    ]
                  }
                ]
              }
            });

            if (existingVariant) {
              // Update existing variant metadata only
              // NOTE: Do NOT overwrite stock - Neon is source of truth for inventory
              // Stock is managed via order decrements and manual restocking only
              await prisma.productVariant.update({
                where: { id: existingVariant.id },
                data: {
                  // stock is NOT updated - preserving Neon's stock value
                  sku: sku,
                  size: size,
                  color: color
                }
              });
              console.log(`Variant ${sku} updated (stock preserved at ${existingVariant.stock}, Sanity has ${quantity})`);
            } else {
              // Create new variant
              await prisma.productVariant.create({
                data: {
                  productId: product.id,
                  sku: sku,
                  size: size,
                  color: color,
                  stock: quantity,
                }
              });
            }
          }
        }
      }

    } catch (error) {
      console.error(`Error syncing product ${sanityProduct._id}:`, error);
    }
  }

  console.log("Product sync completed");
}