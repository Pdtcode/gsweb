import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Use your existing API_SYNC_KEY
const WEBHOOK_SECRET = process.env.API_SYNC_KEY;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("No API_SYNC_KEY configured - skipping signature verification");
    return true;
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

    const webhook = JSON.parse(body);
    console.log("=== Sanity Unified Webhook ===");
    console.log("Document type:", webhook._type);
    console.log("Transition:", webhook.transition);

    // Handle different document types
    if (webhook._type === "order") {
      // Forward to existing order webhook logic
      return await handleOrderWebhook(request, body);
    } else if (webhook._type === "product") {
      // Handle product updates
      return await handleProductWebhook(webhook);
    }

    return NextResponse.json({ message: "Webhook received but no action needed" });

  } catch (error) {
    console.error("Unified webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleOrderWebhook(request: NextRequest, body: string) {
  // Call your existing order webhook
  const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhooks/sanity-order-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sanity-signature': request.headers.get("x-sanity-signature") || '',
    },
    body: body,
  });

  const orderResult = await orderResponse.json();
  return NextResponse.json(orderResult, { status: orderResponse.status });
}

async function handleProductWebhook(webhook: any) {
  console.log("Processing product webhook:", webhook._id);

  // Only process updates, creates, and publishes
  if (!webhook.transition || !['update', 'create', 'publish'].includes(webhook.transition)) {
    console.log("Ignoring product webhook - not an update/create/publish");
    return NextResponse.json({ message: "Product webhook ignored - wrong transition" });
  }

  try {
    // Call your existing sync-inventory endpoint
    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync-inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: webhook._id }),
    });

    const syncResult = await syncResponse.json();

    if (syncResponse.ok) {
      console.log("Product sync completed successfully");
      return NextResponse.json({
        success: true,
        message: `Product ${webhook._id} synced successfully`,
        details: syncResult
      });
    } else {
      console.error("Product sync failed:", syncResult);
      return NextResponse.json(
        { error: "Product sync failed", details: syncResult },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error("Error calling sync-inventory:", error);
    return NextResponse.json(
      { error: "Failed to sync product" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Sanity unified webhook endpoint",
    endpoint: "/api/webhooks/sanity-unified",
    handles: ["orders", "products"]
  });
}