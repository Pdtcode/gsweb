import crypto from "crypto";
import { createClient } from "@sanity/client";

/**
 * Site password gate settings, edited in Sanity Studio ("Site Password").
 *
 * The production dataset is publicly readable, so the settings live in a
 * document whose id contains a dot. Sanity treats ids like that as a private
 * path (the same way drafts are hidden): they can only be read with a token,
 * so the password never shows up in the public API.
 */
export const SITE_PROTECTION_DOC_ID = "settings.siteProtection";

// Changes in the Studio reach the site within this many seconds
const SETTINGS_REVALIDATE_SECONDS = 60;

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
  token: process.env.SANITY_API_TOKEN,
});

export interface SiteProtectionSettings {
  enabled: boolean;
  password: string | null;
}

// Used until the Studio document is published, and if Sanity can't be
// reached: the gate stays on with the password from the environment.
const legacySettings = (): SiteProtectionSettings => ({
  enabled: true,
  password: process.env.SITE_PASSWORD || "lextryagain2026",
});

export async function getSiteProtection(): Promise<SiteProtectionSettings> {
  try {
    const doc = await sanityClient.fetch<{ enabled?: boolean; password?: string } | null>(
      `*[_id == $id][0]{ enabled, password }`,
      { id: SITE_PROTECTION_DOC_ID },
      { next: { revalidate: SETTINGS_REVALIDATE_SECONDS } }
    );

    if (!doc) return legacySettings();

    return { enabled: doc.enabled === true, password: doc.password || null };
  } catch (error) {
    console.error("[site-protection] Failed to load settings from Sanity:", error);
    return legacySettings();
  }
}

/**
 * What a visitor's browser keeps after entering the right password. It is
 * derived from the password with a server-only key, so it can be put in the
 * page without revealing the password, and it changes whenever the password
 * does — which signs everyone out.
 */
export function accessKeyFor(password: string): string {
  return crypto
    .createHmac("sha256", process.env.SANITY_API_TOKEN || "grailseekers-site-access")
    .update(password)
    .digest("hex")
    .slice(0, 32);
}
