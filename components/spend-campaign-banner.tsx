import { campaignBannerText, type SpendCampaign } from "@/lib/spend-campaign";

/**
 * Slim announcement bar for the Spend & Save campaign, shown above the navbar
 * on every page while the campaign is live and "Show banner" is on in Studio.
 */
export function SpendCampaignBanner({ campaign }: { campaign: SpendCampaign }) {
  const text = campaignBannerText(campaign);

  if (!text) return null;

  return (
    <div
      aria-label={campaign.name}
      className="w-full bg-foreground text-background text-center text-xs sm:text-sm font-medium tracking-wide px-4 py-2"
      role="region"
    >
      {text}
    </div>
  );
}
