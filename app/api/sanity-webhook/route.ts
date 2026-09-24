import { NextRequest, NextResponse } from "next/server";
import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";

import { hideDeletedProduct, syncProductsFromSanity } from "@/lib/productSync";

/**
 * Sanity webhook: keeps Neon products in step with Sanity automatically.
 * Configured in sanity.io/manage → API → Webhooks ("Product → database"):
 *   filter:     _type == "product"
 *   triggers:   create, update, delete (published documents only)
 *   projection: {_id, _type, "slug": coalesce(after().slug.current, before().slug.current), "transition": delta::operation()}
 *   secret:     same value as SANITY_WEBHOOK_SECRET
 */

const WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET;

interface ProductWebhookPayload {
  _id: string;
  _type: string;
  slug?: string | null;
  transition?: "create" | "update" | "delete";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get(SIGNATURE_HEADER_NAME);

    if (!WEBHOOK_SECRET) {
      console.error("SANITY_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    if (!signature || !(await isValidSignature(body, signature, WEBHOOK_SECRET))) {
      console.error("Invalid or missing Sanity webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: ProductWebhookPayload = JSON.parse(body);

    if (payload._type !== "product" || !payload._id || payload._id.startsWith("drafts.")) {
      return NextResponse.json({ message: "Ignored: not a published product" });
    }

    if (payload.transition === "delete") {
      const hidden = await hideDeletedProduct(payload._id, payload.slug);

      console.log(`[sanity-webhook] Product ${payload._id} deleted in Sanity — hidden ${hidden} row(s)`);
      return NextResponse.json({ success: true, action: "hidden", hidden });
    }

    const results = await syncProductsFromSanity(payload._id);
    const failed = results.filter((r) => r.action === "failed");

    console.log(`[sanity-webhook] Synced product ${payload._id}: ${results.length} result(s), ${failed.length} failed`);

    // A 500 makes Sanity retry the delivery
    return NextResponse.json(
      { success: failed.length === 0, results },
      { status: failed.length ? 500 : 200 }
    );
  } catch (error) {
    console.error("[sanity-webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
