import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateOrderStatus, getOrderByPaymentIntentId, restoreOrderStock, decrementOrderStock } from "@/app/actions/orderActions";
import { DualSyncService } from "@/lib/dualSyncService";
import prisma from "@/lib/prismaClient";
import { orderEventEmitter } from "@/lib/events/order-events";
import "@/lib/services/email-service"; // Initialize email service

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// This is critical for Stripe webhook signature verification
// Next.js needs to NOT parse the body so we can get the raw string
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log("=== STRIPE WEBHOOK RECEIVED ===");
  console.log("Timestamp:", new Date().toISOString());

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;

    console.log("Webhook signature present:", !!sig);
    console.log("Signature value:", sig ? sig.substring(0, 50) + "..." : "NONE");
    console.log("Endpoint secret configured:", !!endpointSecret);
    console.log("Endpoint secret prefix:", endpointSecret ? endpointSecret.substring(0, 10) + "..." : "NONE");
    console.log("Body length:", body.length);
    console.log("Body start:", body.substring(0, 100));

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
      console.log("✅ Webhook signature verified successfully");
      console.log("Event type:", event.type);
      console.log("Event ID:", event.id);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      console.error("Error type:", err instanceof Error ? err.constructor.name : typeof err);
      console.error("Error message:", err instanceof Error ? err.message : String(err));

      // Development bypass - REMOVE IN PRODUCTION
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_WEBHOOK_SIGNATURE) {
        console.log("⚠️ DEVELOPMENT MODE: Bypassing webhook signature verification");
        try {
          event = JSON.parse(body);
        } catch (parseErr) {
          console.error("❌ Failed to parse webhook body as JSON:", parseErr);
          return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        console.log("📝 Processing payment_intent.succeeded event");
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment Intent ID:", paymentIntent.id);
        console.log("Amount:", paymentIntent.amount, paymentIntent.currency);
        await handlePaymentSuccess(paymentIntent);
        break;

      case "payment_intent.payment_failed":
        console.log("📝 Processing payment_intent.payment_failed event");
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        console.log("Failed Payment Intent ID:", failedPayment.id);
        await handlePaymentFailure(failedPayment);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    console.log("=== WEBHOOK PROCESSING COMPLETE ===\n");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log("\n=== HANDLE PAYMENT SUCCESS STARTED ===");
  console.log("Payment Intent ID:", paymentIntent.id);

  try {
    // Check if this payment intent has already been processed (idempotency check)
    console.log("🔍 Checking for existing webhook log...");
    const existingLog = await prisma.webhookLog.findUnique({
      where: { paymentIntentId: paymentIntent.id }
    });

    if (existingLog) {
      console.log(`⚠️ Payment intent ${paymentIntent.id} already processed at ${existingLog.processedAt}`);
      console.log("=== HANDLE PAYMENT SUCCESS ENDED (DUPLICATE) ===\n");
      return;
    }
    console.log("✅ No existing webhook log found - proceeding with processing");

    console.log("🔍 Fetching order by payment intent ID...");
    const order = await getOrderByPaymentIntentId(paymentIntent.id);

    if (order) {
      console.log(`✅ Order found: ${order.orderNumber} (ID: ${order.id})`);
      console.log("Order items count:", order.OrderItem.length);

      // Log order items details
      order.OrderItem.forEach((item, index) => {
        console.log(`  Item ${index + 1}:`, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.Product?.name
        });
      });

      // First decrement the inventory in Neon
      console.log("\n📦 Starting inventory decrement...");
      await decrementOrderStock(order.id);
      console.log(`✅ Inventory decremented in Neon for order ${order.orderNumber}`);

      // Sync inventory to Sanity
      console.log("\n🔄 Starting Sanity sync...");
      try {
        await DualSyncService.syncInventoryToSanity(order.id);
        console.log(`✅ Inventory synced to Sanity for order ${order.orderNumber}`);
      } catch (syncError) {
        console.error(`❌ Failed to sync inventory to Sanity for order ${order.orderNumber}:`, syncError);
        // Continue even if Sanity sync fails - Neon is source of truth
      }

      // Then update order status
      console.log("\n📝 Updating order status...");
      await updateOrderStatus(order.id, "PROCESSING");
      console.log(`✅ Order ${order.orderNumber} marked as PROCESSING after successful payment`);

      // Log successful processing to prevent duplicate processing
      console.log("\n💾 Creating webhook log...");
      await prisma.webhookLog.create({
        data: {
          paymentIntentId: paymentIntent.id,
          eventType: 'payment_intent.succeeded',
          orderId: order.id
        }
      });
      console.log(`✅ Webhook processing logged for payment intent ${paymentIntent.id}`);

      // Send order confirmation email AFTER inventory decrement succeeds
      console.log("\n📧 Sending order confirmation email...");
      try {
        // Get customer info from order shipping fields or metadata
        const customerEmail = order.shippingEmail || paymentIntent.metadata?.customer_email || '';
        const customerName = [order.shippingFirstName, order.shippingLastName].filter(Boolean).join(' ') || paymentIntent.metadata?.customer_name || '';

        // Build shipping address string
        const shippingAddress = [
          order.shippingAddress,
          order.shippingCity,
          order.shippingState,
          order.shippingZipCode,
          order.shippingCountry
        ].filter(Boolean).join(', ') || paymentIntent.metadata?.shipping_address || '';

        // Get service fee and discount from payment intent metadata
        const serviceFeeBase = parseFloat(paymentIntent.metadata?.service_fee_base || '0');
        const serviceFeeDiscount = parseFloat(paymentIntent.metadata?.service_fee_discount || '0');
        const serviceFeeAmount = parseFloat(paymentIntent.metadata?.service_fee_final || '0');
        const discountAmount = parseFloat(paymentIntent.metadata?.discount_amount || '0');
        const discountCode = paymentIntent.metadata?.discount_code || '';

        await orderEventEmitter.emitOrderConfirmed({
          orderId: order.id.toString(),
          orderNumber: order.orderNumber,
          customerEmail: customerEmail,
          customerName: customerName,
          total: Number(order.total),
          items: order.OrderItem.map((item) => ({
            name: item.Product?.name || 'Product',
            quantity: item.quantity,
            price: Number(item.price),
            variantInfo: item.ProductVariant
              ? `${item.ProductVariant.size ? `Size: ${item.ProductVariant.size}` : ''}${item.ProductVariant.size && item.ProductVariant.color ? ', ' : ''}${item.ProductVariant.color ? `Color: ${item.ProductVariant.color}` : ''}`
              : undefined
          })),
          shippingAddress: shippingAddress,
          paymentIntentId: paymentIntent.id,
          serviceFee: serviceFeeAmount > 0 ? {
            baseAmount: serviceFeeBase,
            discount: serviceFeeDiscount,
            finalAmount: serviceFeeAmount
          } : undefined,
          discount: discountAmount > 0 && discountCode ? {
            code: discountCode,
            amount: discountAmount
          } : undefined,
          createdAt: new Date().toISOString()
        });

        console.log(`✅ Order confirmation email sent for ${order.orderNumber}`);
      } catch (emailError) {
        console.error(`❌ Failed to send order confirmation email for ${order.orderNumber}:`, emailError);
        // Don't fail the webhook if email fails - payment and inventory are already processed
      }
    } else {
      console.error(`❌ No order found for payment intent: ${paymentIntent.id}`);
      console.error("This usually means the order wasn't created properly in the database");
    }

    console.log("=== HANDLE PAYMENT SUCCESS ENDED ===\n");
  } catch (error) {
    console.error("❌ ERROR IN HANDLE PAYMENT SUCCESS:", error);
    console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    throw error;
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    const order = await getOrderByPaymentIntentId(paymentIntent.id);

    if (order) {
      // First restore the stock before cancelling
      await restoreOrderStock(order.id);
      console.log(`✅ Stock restored in Neon for order ${order.orderNumber}`);

      // Sync restored inventory to Sanity
      try {
        await DualSyncService.syncInventoryToSanity(order.id);
        console.log(`✅ Restored inventory synced to Sanity for order ${order.orderNumber}`);
      } catch (syncError) {
        console.error(`Failed to sync restored inventory to Sanity for order ${order.orderNumber}:`, syncError);
        // Continue even if Sanity sync fails - Neon is source of truth
      }

      // Then update the order status
      await updateOrderStatus(order.id, "CANCELLED");
      console.log(`✅ Order ${order.orderNumber} marked as CANCELLED after payment failure`);
    } else {
      console.error(`No order found for payment intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}