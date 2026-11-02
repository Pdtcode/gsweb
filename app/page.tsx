import type { Metadata } from "next";

import DefaultHome from "@/components/default-home";
import NewArrivalsHome from "@/components/new-arrivals-home";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";
import { brandDescription, buildMetadata } from "@/lib/seo";

// To switch homepages (and the navbar) back to the original, set
// HOMEPAGE_VARIANT to "default" in config/homepage.ts — that's the only edit.

// Picks up products and Grails published in the Studio without a redeploy.
export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  // No title override → inherits the branded root layout title.
  description: brandDescription,
  path: "/",
});

export default function Home() {
  return NEW_ARRIVALS_HOME_ACTIVE ? <NewArrivalsHome /> : <DefaultHome />;
}
