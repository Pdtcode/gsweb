import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

/**
 * Gate for the manual maintenance endpoints (order/product sync). They rewrite
 * orders, so the caller must send `Authorization: Bearer <API_SYNC_KEY>`.
 *
 * Fails closed: with API_SYNC_KEY unset nobody gets in. Nothing in gsweb, the
 * Studio or Sanity's webhooks calls these routes, so that breaks nothing.
 *
 * Returns a response to send back when the caller is NOT allowed, else null.
 */
export function rejectWithoutSyncKey(request: Request): NextResponse | null {
  const expected = process.env.API_SYNC_KEY;
  const given =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (expected && safeEqual(given, expected)) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
