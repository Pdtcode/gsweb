import type { Metadata } from "next";

// To switch back to the default homepage, change the import below:
import DefaultHome from "@/components/default-home";
// Then use <DefaultHome /> instead of <GiveawayPromoHome />

// import GiveawayPromoHome from "@/components/giveaway-promo-home";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  // No title override → inherits the branded root layout title.
  description:
    "Grail Seekers is a streetwear brand built around limited-edition drops and curated collections. Shop exclusive apparel with fast shipping or local pickup. Seek until you find.",
  path: "/",
});

export default function Home() {
  return <DefaultHome />;
}
