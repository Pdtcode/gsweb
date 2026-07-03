import type { Metadata } from "next";

import DefaultHome from "@/components/default-home";
import NewArrivalsHome from "@/components/new-arrivals-home";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";
import { buildMetadata } from "@/lib/seo";

// To switch homepages (and the navbar) back to the original, set
// HOMEPAGE_VARIANT to "default" in config/homepage.ts — that's the only edit.

export const metadata: Metadata = buildMetadata({
  // No title override → inherits the branded root layout title.
  description:
    "Grail Seekers is a streetwear brand built around limited-edition drops and curated collections. Shop exclusive apparel with fast shipping or local pickup. Seek until you find.",
  path: "/",
});

export default function Home() {
  return NEW_ARRIVALS_HOME_ACTIVE ? <NewArrivalsHome /> : <DefaultHome />;
}
