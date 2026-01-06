import Stripe from "stripe";
import { NextResponse } from "next/server";

import prisma from "@/lib/prismaClient";

// Make sure the Stripe secret key is defined
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing Stripe secret key");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request: Request) {
  try {
    console.log("=== Payment Intent Request Started ===");
    const requestBody = await request.json();
    console.log("Request body:", JSON.stringify(requestBody, null, 2));
    const { items, shipping, metadata, discount, serviceFee } = requestBody;

    if (!items || !items.length) {
      console.error("No items provided in request");
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 },
      );
    }

    console.log("Items validation passed, found", items.length, "items");

    // Validate inventory before processing payment
    const inventoryValidation = [];
    let hasStockIssues = false;

    for (const item of items) {
      console.log("Processing item:", item.name, "with variantId:", item.variantId);

      if (!item.variantId) {
        console.log("Skipping item without variantId");
        continue; // Skip validation for products without variants
      }

      // Try to find variant by ID first, then by SKU if ID fails
      let variant = null;
      try {
        console.log("Trying to find variant by ID:", item.variantId);
        variant = await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: {
            Product: {
              select: {
                name: true,
              },
            },
          },
        });
        console.log("Variant found by ID:", variant ? "YES" : "NO");
      } catch (error) {
        console.log("ID lookup failed, trying SKU lookup");
        // If ID lookup fails, try SKU lookup
        variant = await prisma.productVariant.findUnique({
          where: { sku: item.variantId },
          include: {
            Product: {
              select: {
                name: true,
              },
            },
          },
        });
        console.log("Variant found by SKU:", variant ? "YES" : "NO");
      }

      // If still not found, try to find by size/color combination
      if (!variant && item.variantSize && item.variantColor) {
        console.log("Trying to find variant by size/color:", item.variantSize, item.variantColor);
        // Try multiple ways to find the product - by ID, slug, or name
        const allVariants = await prisma.productVariant.findMany({
          where: {
            Product: {
              OR: [
                { id: item.id },
                { slug: { contains: "yots2025" } },
                { name: { contains: "Year of the Snake" } }
              ]
            }
          },
          include: {
            Product: {
              select: {
                name: true,
                id: true,
                slug: true
              },
            },
          },
        });

        console.log("Available variants for this product:");
        allVariants.forEach((v, index) => {
          console.log(`  ${index + 1}. ID: ${v.id}, SKU: ${v.sku}, Size: "${v.size}", Color: "${v.color}", Stock: ${v.stock}`);
        });

        // Try to match by size and color in the variant's size field
        variant = allVariants.find(v =>
          v.size.toLowerCase().includes(item.variantSize.toLowerCase()) &&
          (v.size.toLowerCase().includes(item.variantColor.toLowerCase()) ||
           v.color?.toLowerCase().includes(item.variantColor.toLowerCase()))
        );

        console.log("Variant found by size/color match:", variant ? "YES" : "NO");
        if (variant) {
          console.log("Matched variant:", variant.sku, variant.size);
        } else {
          console.log("No size/color match found for:", item.variantSize, "+", item.variantColor);
        }
      }

      if (!variant) {
        console.log("❌ VARIANT NOT FOUND - Adding to inventory issues");
        console.log("Searched for variantId:", item.variantId);
        console.log("Searched for size/color:", item.variantSize, "+", item.variantColor);
        inventoryValidation.push({
          productName: item.name,
          variantId: item.variantId,
          issue: "Product variant not found",
        });
        hasStockIssues = true;
        continue;
      }

      console.log("✅ VARIANT FOUND:", variant.sku, "- Stock:", variant.stock);

      if (variant.stock < item.quantity) {
        inventoryValidation.push({
          productName: variant.Product.name,
          variantId: item.variantId,
          variantSize: variant.size,
          variantColor: variant.color,
          requestedQuantity: item.quantity,
          availableStock: variant.stock,
          issue: `Only ${variant.stock} units available`,
        });
        hasStockIssues = true;
      }
    }

    // If there are stock issues, return error with details
    if (hasStockIssues) {
      console.log("❌ CHECKOUT FAILED - Stock Issues:");
      console.log(JSON.stringify(inventoryValidation, null, 2));
      return NextResponse.json(
        {
          error: "Insufficient stock for one or more items",
          stockIssues: inventoryValidation,
        },
        { status: 400 }
      );
    }

    console.log("✅ All inventory validation passed - proceeding to payment intent creation");

    // Extract customer info from metadata if available
    const customerName = metadata?.customer_name || "";
    const customerEmail = metadata?.customer_email || "";
    const shippingAddress = metadata?.shipping_address || "";

    // Parse shipping address for storing in shipping object
    const addressParts = shippingAddress
      .split(",")
      .map((part: string) => part.trim());
    const shippingAddressData =
      addressParts.length >= 5
        ? {
            line1: addressParts[0],
            city: addressParts[1],
            state: addressParts[2],
            postal_code: addressParts[3],
            country: addressParts[4], // ISO country codes expected
          }
        : undefined;

    // Calculate subtotal from items
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    // Apply discount if provided
    const discountAmount = discount?.amount || 0;
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    // Apply service fee calculations
    const serviceFeeAmount = serviceFee?.finalServiceFee || 0;
    const baseServiceFee = serviceFee?.baseServiceFee || 0;
    const serviceFeeDiscount = serviceFee?.serviceFeeDiscount || 0;

    const total = subtotalAfterDiscount + serviceFeeAmount;

    // Shipping cost (optional, could be zero)
    const shippingCost = shipping?.cost || 0;

    // Create payment intent without tax calculation
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // total in cents
      currency: "usd",
      metadata: {
        ...metadata,
        subtotal: subtotal.toString(),
        discount_amount: discountAmount.toString(),
        discount_code: discount?.code || "",
        service_fee_base: baseServiceFee.toString(),
        service_fee_discount: serviceFeeDiscount.toString(),
        service_fee_final: serviceFeeAmount.toString(),
        service_fee_percentage: serviceFee?.percentage?.toString() || "5",
        total: total.toString(),
        shipping_cost: shippingCost.toString(),
        item_count: items.length.toString(),
        created_at: new Date().toISOString(),
        items: JSON.stringify(
          items.map((item: any) => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
          })),
        ),
        user_id: metadata?.user_id || "",
      },
      description: `Order for ${customerName || "Customer"}`,
      receipt_email: customerEmail,
      payment_method_types: ["card"],
      statement_descriptor: "GrailSeekers Order",
      shipping: shippingAddressData
        ? {
            name: customerName,
            address: shippingAddressData,
          }
        : undefined,
      capture_method: "automatic",
    });

    // Create order in the database
    try {
      const firebaseUid = metadata?.user_id || null;

      let user = null;

      if (firebaseUid) {
        user = await prisma.user.findUnique({
          where: { firebaseUid },
        });
      }

      if (!user && customerEmail) {
        user = await prisma.user.findUnique({
          where: { email: customerEmail },
        });
      }

      if (!user && customerEmail) {
        user = await prisma.user.create({
          data: {
            email: customerEmail,
            name: customerName,
            firebaseUid: firebaseUid || null,
          },
        });
      }

      if (!user) {
        throw new Error("Could not identify user for this order");
      }

      // Address management removed - users will use browser autofill

      // Create the order
      console.log("\n📝 Creating order in database...");
      console.log("Payment Intent ID:", paymentIntent.id);
      console.log("User ID:", user.id);
      console.log("Total:", total);

      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          userId: user.id,
          total: total, // This includes subtotal + service fee - discounts
          status: "PROCESSING",
          stripePaymentIntentId: paymentIntent.id,
        },
      });

      console.log(`✅ Order created: ${order.orderNumber} (ID: ${order.id})`);

      // Create order items
      console.log(`\n📦 Creating ${items.length} order item(s)...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`\n--- Processing item ${i + 1}/${items.length} ---`);
        console.log("Item:", {
          id: item.id,
          name: item.name,
          variantId: item.variantId,
          variantSize: item.variantSize,
          variantColor: item.variantColor,
          quantity: item.quantity
        });

        try {
          let product = null;

          product = await prisma.product.findFirst({
            where: { slug: item.id },
            include: { ProductVariant: true },
          });

          if (!product) {
            product = await prisma.product.findFirst({
              where: { id: item.id },
              include: { ProductVariant: true },
            });

            if (!product && item.originalId) {
              product = await prisma.product.findFirst({
                where: { id: item.originalId },
                include: { ProductVariant: true },
              });
            }

            if (!product && item.name) {
              product = await prisma.product.findFirst({
                where: { name: item.name },
                include: { ProductVariant: true },
              });
            }
          }

          if (!product) {
            product = await prisma.product.create({
              data: {
                name: item.name || `Product from order ${order.id}`,
                description: item.description || "Added during checkout",
                price: item.price,
                images: item.image ? [item.image] : [],
                slug: item.id || `temp-product-${Date.now()}`,
                inStock: true,
              },
              include: { ProductVariant: true },
            });
          }

          let variantId = null;

          // Try to find variant by size and color, or by ID/SKU
          if (product) {
            let variant = null;

            // First try to find by size and color if provided
            if (item.variantSize || item.variantColor) {
              variant = product.ProductVariant.find(
                (v) =>
                  (item.variantSize ? v.size === item.variantSize : true) &&
                  (item.variantColor ? v.color === item.variantColor : true)
              );
            }

            // Fallback to finding by ID or SKU
            if (!variant && item.variantId) {
              variant = product.ProductVariant.find(
                (v) => v.id === item.variantId || v.sku === item.variantId
              );
            }

            if (variant) {
              variantId = variant.id;
              console.log(`✅ Variant matched: ${variant.sku} (ID: ${variant.id})`);
              // Note: Stock will be decremented by Stripe webhook on payment success
              // Do NOT decrement here to avoid double decrement
            } else {
              console.log(`⚠️ No variant found for this item`);
            }
          }

          console.log(`💾 Creating order item with variantId: ${variantId || 'null'}`);

          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              variantId,
              quantity: item.quantity,
              price: product.price,
            },
          });

          console.log(`✅ Order item created successfully`);
        } catch (error) {
          console.error(
            `Error processing item: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          );
        }
      }
    } catch (orderError) {
      console.error(
        `Error creating order: ${
          orderError instanceof Error ? orderError.message : "Unknown error"
        }`,
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      total,
    });
  } catch (error: any) {
    console.error("Payment intent creation error:", error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json({
      error: error.message || "Internal server error"
    }, { status: 500 });
  }
}
