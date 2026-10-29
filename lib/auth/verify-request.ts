import type { DecodedIdToken } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

import prisma from "@/lib/prismaClient";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";

/**
 * Verify the Firebase ID token in the request's `Authorization: Bearer` header.
 * Returns null for a missing, malformed, expired or forged token, so callers
 * can answer 401 instead of 500.
 *
 * Who the caller is must ALWAYS come from this token — never from an email,
 * userId or firebaseUid in the URL or body, which anyone can type.
 */
export async function verifyFirebaseRequest(
  request: Request,
): Promise<DecodedIdToken | null> {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) return null;

  try {
    const app = await getFirebaseAdminApp();

    return await getAuth(app).verifyIdToken(header.slice("Bearer ".length));
  } catch {
    return null;
  }
}

/**
 * The Neon User row belonging to a verified Firebase login.
 *
 * Most User rows are guest rows created at checkout and keyed by email. A login
 * may only claim one by that email once Firebase has VERIFIED the email —
 * otherwise anyone could sign up with a customer's address (email/password
 * sign-up does not require verification) and read that customer's orders.
 */
export async function findUserForToken(token: DecodedIdToken) {
  const linked = await prisma.user.findUnique({
    where: { firebaseUid: token.uid },
  });

  if (linked) return linked;

  if (!token.email || !token.email_verified) return null;

  const byEmail = await prisma.user.findUnique({
    where: { email: token.email },
  });

  // A row already claimed by a different login is not ours
  if (byEmail?.firebaseUid && byEmail.firebaseUid !== token.uid) return null;

  return byEmail;
}
