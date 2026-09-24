import { createClient } from "@sanity/client";

import { isCampaignLive, SPEND_CAMPAIGN_QUERY, type SpendCampaign } from "@/lib/spend-campaign";

const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  useCdn: false,
  apiVersion: "2023-05-03",
});

/**
 * The live Spend & Save campaign, or null when it is off, outside its dates,
 * or Sanity can't be reached (no discount is safer than a wrong one).
 *
 * `fresh` skips Next's data cache — used at checkout so the charged discount
 * reflects the campaign as it is right now. Page renders use a 60 s cache.
 */
export async function getSpendCampaign({ fresh = false } = {}): Promise<SpendCampaign | null> {
  try {
    const campaign = await sanityClient.fetch<SpendCampaign | null>(
      SPEND_CAMPAIGN_QUERY,
      {},
      fresh ? { cache: "no-store" } : { next: { revalidate: 60 } },
    );

    return isCampaignLive(campaign) ? campaign : null;
  } catch (error) {
    console.error("[spend-campaign] Failed to load campaign from Sanity:", error);
    return null;
  }
}
