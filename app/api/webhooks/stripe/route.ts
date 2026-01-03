import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateOrderStatus, getOrderByPaymentIntentId, restoreOrderStock, decrementOrderStock } from "@/app/actions/orderActions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(failedPayment);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const order = await getOrderByPaymentIntentId(paymentIntent.id);

    if (order) {
      // First decrement the inventory
      await decrementOrderStock(order.id);
      console.log(`Inventory decremented for order ${order.orderNumber}`);

      // Then update order status
      await updateOrderStatus(order.id, "PROCESSING");
      console.log(`Order ${order.orderNumber} marked as PROCESSING after successful payment`);
    } else {
      console.error(`No order found for payment intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error("Error handling payment success:", error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    const order = await getOrderByPaymentIntentId(paymentIntent.id);

    if (order) {
      // First restore the stock before cancelling
      await restoreOrderStock(order.id);
      console.log(`Stock restored for order ${order.orderNumber}`);

      // Then update the order status
      await updateOrderStatus(order.id, "CANCELLED");
      console.log(`Order ${order.orderNumber} marked as CANCELLED after payment failure`);
    } else {
      console.error(`No order found for payment intent: ${paymentIntent.id}`);
    }
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}