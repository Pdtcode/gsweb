/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  SINGLE SWITCH FOR THE HOMEPAGE EXPERIENCE                         │
 * │                                                                   │
 * │  Change HOMEPAGE_VARIANT below and BOTH of these flip together:   │
 * │    • which homepage renders (app/page.tsx)                        │
 * │    • the navbar styling (maroon "Life Sucks" theme vs. default)   │
 * │                                                                   │
 * │  To restore the original site, set it to "default".              │
 * └─────────────────────────────────────────────────────────────────┘
 */
export type HomepageVariant = "default" | "new-arrivals";

// 👇 The only line you need to change: "default" or "new-arrivals".
// (The `as HomepageVariant` keeps the union type so comparisons below stay valid.)
export const HOMEPAGE_VARIANT = "default" as HomepageVariant;

/**
 * True when the "Life Sucks" new-arrivals homepage is active. The navbar
 * (background + cream text/icons) reads this so it stays in sync with the
 * homepage — no styling lingers after switching back to "default".
 */
export const NEW_ARRIVALS_HOME_ACTIVE = HOMEPAGE_VARIANT === "new-arrivals";
