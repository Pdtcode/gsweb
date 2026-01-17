import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import prisma from "@/lib/prismaClient";

// CORS headers for Sanity Studio
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

// Handle preflight OPTIONS request
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();

    // If productId is provided, sync only that product
    // Otherwise, sync all products
    const query = productId
      ? `*[_type == "product" && _id == $productId][0]`
      : `*[_type == "product"]`;

    const params = productId ? { productId } : {};
    const sanityProducts = productId
      ? [await sanityClient.fetch(query, params)]
      : await sanityClient.fetch(query);

    if (!sanityProducts || (Array.isArray(sanityProducts) && sanityProducts.length === 0)) {
      return NextResponse.json(
        { error: "No products found in Sanity" },
        { status: 404 }
      );
    }

    const syncResults = [];
    const products = Array.isArray(sanityProducts) ? sanityProducts : [sanityProducts];

    for (const sanityProduct of products) {
      if (!sanityProduct) continue;

      try {
        // Find or create product in database
        let dbProduct = await prisma.product.findFirst({
          where: {
            OR: [
              { id: sanityProduct._id },
              { slug: sanityProduct.slug?.current },
              { name: sanityProduct.name },
            ],
          },
          include: {
            ProductVariant: true,
          },
        });

        if (!dbProduct) {
          // Create new product if it doesn't exist
          dbProduct = await prisma.product.create({
            data: {
              name: sanityProduct.name,
              slug: sanityProduct.slug?.current || `product-${Date.now()}`,
              description: sanityProduct.description || "",
              price: sanityProduct.price || 0,
              images: sanityProduct.mainImage
                ? [
                    `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${sanityProduct.mainImage.asset._ref.replace("image-", "").replace("-jpg", ".jpg").replace("-png", ".png")}`,
                  ]
                : [],
              inStock: sanityProduct.inStock ?? true,
            },
            include: {
              ProductVariant: true,
            },
          });
        } else {
          // Update existing product with latest data including price
          dbProduct = await prisma.product.update({
            where: { id: dbProduct.id },
            data: {
              name: sanityProduct.name,
              description: sanityProduct.description || "",
              price: sanityProduct.price || 0,
              images: sanityProduct.mainImage
                ? [
                    `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${sanityProduct.mainImage.asset._ref.replace("image-", "").replace("-jpg", ".jpg").replace("-png", ".png")}`,
                  ]
                : [],
              inStock: sanityProduct.inStock ?? true,
            },
            include: {
              ProductVariant: true,
            },
          });
        }

        // Sync inventory based on whether product has variants
        if (sanityProduct.variants && sanityProduct.variants.length > 0) {
          // Product has variants - sync variant inventory
          for (const variant of sanityProduct.variants) {
            if (!variant.inventory || variant.inventory.length === 0) continue;

            for (const inventoryItem of variant.inventory) {
              const sku = inventoryItem.sku || `${sanityProduct.slug?.current}-${inventoryItem.option}`;
              const quantity = inventoryItem.quantity || 0;

              // Try to find existing variant by SKU
              let dbVariant = await prisma.productVariant.findFirst({
                where: {
                  productId: dbProduct.id,
                  sku: sku,
                },
              });

              if (dbVariant) {
                // Update existing variant with correct size/color mapping
                const option = inventoryItem.option;
                let size, color;

                if (variant.name === "Color") {
                  // For color variants like "White Medium", "Black Large"
                  const parts = option.split(" ");
                  if (parts.length >= 2) {
                    color = parts[0]; // "White", "Black"
                    size = parts.slice(1).join(" "); // "Medium", "Large", "X-Large"
                  } else {
                    color = option;
                    size = "One Size";
                  }
                } else if (variant.name === "Size") {
                  // For size variants like "Small", "Medium", "Large"
                  size = option;
                  color = "Size"; // Default for size-only variants
                } else {
                  // Fallback for other variant types
                  size = option;
                  color = variant.name || "Default";
                }

                await prisma.productVariant.update({
                  where: { id: dbVariant.id },
                  data: {
                    stock: quantity,
                    size: size,
                    color: color,
                  },
                });

                syncResults.push({
                  productName: sanityProduct.name,
                  variantSku: sku,
                  action: "updated",
                  quantity: quantity,
                });
              } else {
                // Create new variant
                // Parse the option to extract size/color based on variant type
                const option = inventoryItem.option;
                let size, color;

                if (variant.name === "Color") {
                  // For color variants like "White Medium", "Black Large"
                  const parts = option.split(" ");
                  if (parts.length >= 2) {
                    color = parts[0]; // "White", "Black"
                    size = parts.slice(1).join(" "); // "Medium", "Large", "X-Large"
                  } else {
                    color = option;
                    size = "One Size";
                  }
                } else if (variant.name === "Size") {
                  // For size variants like "Small", "Medium", "Large"
                  size = option;
                  color = "Size"; // Default for size-only variants
                } else {
                  // Fallback for other variant types
                  size = option;
                  color = variant.name || "Default";
                }

                await prisma.productVariant.create({
                  data: {
                    productId: dbProduct.id,
                    size: size,
                    color: color,
                    sku: sku,
                    stock: quantity,
                  },
                });

                syncResults.push({
                  productName: sanityProduct.name,
                  variantSku: sku,
                  action: "created",
                  quantity: quantity,
                });
              }
            }
          }
        } else if (sanityProduct.totalInventory !== undefined) {
          // Product has no variants - use totalInventory
          const sku = sanityProduct.sku || `${sanityProduct.slug?.current}-default`;
          const quantity = sanityProduct.totalInventory || 0;

          let dbVariant = await prisma.productVariant.findFirst({
            where: {
              productId: dbProduct.id,
              sku: sku,
            },
          });

          if (dbVariant) {
            await prisma.productVariant.update({
              where: { id: dbVariant.id },
              data: {
                stock: quantity,
              },
            });

            syncResults.push({
              productName: sanityProduct.name,
              variantSku: sku,
              action: "updated",
              quantity: quantity,
            });
          } else {
            await prisma.productVariant.create({
              data: {
                productId: dbProduct.id,
                size: "Default",
                color: null,
                sku: sku,
                stock: quantity,
              },
            });

            syncResults.push({
              productName: sanityProduct.name,
              variantSku: sku,
              action: "created",
              quantity: quantity,
            });
          }
        }
      } catch (error) {
        console.error(`Error syncing product ${sanityProduct.name}:`, error);
        syncResults.push({
          productName: sanityProduct.name,
          action: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      message: "Inventory sync completed",
      results: syncResults,
      totalProcessed: syncResults.length,
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
