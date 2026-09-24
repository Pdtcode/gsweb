/**
 * Site-wide "Spend & Save" campaign: spend at least $X on items and get a
 * fixed $Y off, with multiple tiers (the highest tier reached wins).
 *
 * Configured in Sanity Studio → Store Setup → Spend & Save (a single document
 * with id `spendCampaign`). This module has no server-only imports so the
 * checkout page and the payment-intent route compute the discount the same
 * way; the server's result is the one that is charged.
 */

export interface SpendTier {
  minSpend: number;
  discount: number;
}

export interface SpendCampaign {
  name: string;
  tiers: SpendTier[];
  startsAt?: string | null;
  endsAt?: string | null;
  showBanner?: boolean | null;
  bannerText?: string | null;
}

export interface SpendDiscount {
  discount: number;
  tier: SpendTier | null;
  nextTier: SpendTier | null;
}

export const SPEND_CAMPAIGN_DOC_ID = "spendCampaign";

// Only an enabled, published campaign is returned
export const SPEND_CAMPAIGN_QUERY = `*[_id == "${SPEND_CAMPAIGN_DOC_ID}" && enabled == true][0]{
  "name": coalesce(name, "Spend & Save"),
  "tiers": tiers[]{ minSpend, discount },
  startsAt,
  endsAt,
  showBanner,
  bannerText
}`;

const roundCents = (value: number) => Math.round(value * 100) / 100;

/** True when the campaign exists, has a usable tier and is inside its dates. */
export function isCampaignLive(
  campaign: SpendCampaign | null | undefined,
  now: Date = new Date(),
): campaign is SpendCampaign {
  if (!campaign || validTiers(campaign).length === 0) return false;
  if (campaign.startsAt && new Date(campaign.startsAt) > now) return false;
  if (campaign.endsAt && new Date(campaign.endsAt) <= now) return false;

  return true;
}

/** Tiers that make sense (discount smaller than the spend), lowest spend first. */
export function validTiers(campaign: SpendCampaign): SpendTier[] {
  return (campaign.tiers ?? [])
    .filter(
      (tier) =>
        Number.isFinite(tier?.minSpend) &&
        Number.isFinite(tier?.discount) &&
        tier.minSpend > 0 &&
        tier.discount > 0 &&
        tier.discount < tier.minSpend,
    )
    .sort((a, b) => a.minSpend - b.minSpend);
}

/**
 * The discount for an items subtotal (merchandise after bundle savings,
 * before service fees and promo codes).
 */
export function getSpendDiscount(
  subtotal: number,
  campaign: SpendCampaign | null | undefined,
  now: Date = new Date(),
): SpendDiscount {
  if (!isCampaignLive(campaign, now)) {
    return { discount: 0, tier: null, nextTier: null };
  }

  const tiers = validTiers(campaign);
  const reached = tiers.filter((tier) => subtotal >= tier.minSpend);
  const tier = reached.length > 0 ? reached[reached.length - 1] : null;
  const nextTier = tiers.find((t) => subtotal < t.minSpend) ?? null;

  return {
    discount: tier ? roundCents(Math.min(tier.discount, subtotal)) : 0,
    tier,
    nextTier,
  };
}

const dollars = (value: number) =>
  Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;

/** Banner copy: the Studio text if set, otherwise built from the tiers. */
export function campaignBannerText(campaign: SpendCampaign): string {
  if (campaign.bannerText?.trim()) return campaign.bannerText.trim();

  return validTiers(campaign)
    .map((tier) => `Spend ${dollars(tier.minSpend)}, get ${dollars(tier.discount)} off`)
    .join(" · ");
}
