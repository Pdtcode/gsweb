import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans, fontUDMincho } from "@/config/fonts";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import SiteProtection from "@/components/site-protection";
import { accessKeyFor, getSiteProtection } from "@/lib/site-protection";
import { getSpendCampaign } from "@/lib/spend-campaign-server";
import { SpendCampaignBanner } from "@/components/spend-campaign-banner";
import { SkuProvider } from "@/lib/contexts/sku-context";
import { JsonLd } from "@/components/json-ld";
import {
  absoluteUrl,
  brandDescription,
  defaultOgImage,
  defaultOgImageSize,
  siteKeywords,
  siteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} (GS Design Research) | Streetwear Drops`,
    template: `%s - ${siteConfig.name}`,
  },
  description: brandDescription,
  applicationName: siteConfig.name,
  keywords: siteKeywords,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.description}`,
    description:
      "Limited-edition streetwear from Oklahoma City. Seek until you find.",
    images: [
      {
        url: defaultOgImage,
        ...defaultOgImageSize,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.description}`,
    description:
      "Limited-edition streetwear from Oklahoma City. Seek until you find.",
    images: [defaultOgImage],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  alternateName: "GS Design Research",
  url: siteUrl,
  logo: absoluteUrl("/logo-light.svg"),
  description: brandDescription,
  slogan: siteConfig.description,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Oklahoma City",
    addressRegion: "OK",
    addressCountry: "US",
  },
  sameAs: ["https://www.instagram.com/gsdesignresearch/"],
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  alternateName: "GS Design Research",
  url: siteUrl,
};

export const viewport: Viewport = {
  // Explicit so the mobile viewport meta is always emitted — without
  // width=device-width, iPhones fall back to a ~980px desktop layout and the
  // page renders zoomed-out / broken.
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Password gate is switched on/off and its password set in Sanity Studio
  const [siteProtection, spendCampaign] = await Promise.all([
    getSiteProtection(),
    getSpendCampaign(),
  ]);
  const siteAccessKey =
    siteProtection.enabled && siteProtection.password
      ? accessKeyFor(siteProtection.password)
      : null;
  // `next dev` skips the gate so local work isn't stuck behind the live
  // password (dev reads the production dataset, so it would otherwise follow
  // the Studio toggle). NODE_ENV is fixed at build time, so `next build` —
  // and therefore Netlify — always honours the Sanity setting.
  const siteGateEnabled =
    siteProtection.enabled && process.env.NODE_ENV !== "development";

  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased transition-colors duration-700 ease-in-out",
          fontSans.variable,
          fontUDMincho.variable,
        )}
      >
        <JsonLd data={organizationLd} />
        <JsonLd data={websiteLd} />
        {/* New-arrivals homepage defaults to light; the original site keeps
            dark. Users can still toggle either way (this is only the default
            when there's no stored preference). */}
        <Providers
          themeProps={{
            attribute: "class",
            defaultTheme: NEW_ARRIVALS_HOME_ACTIVE ? "light" : "dark",
          }}
        >
          <SkuProvider>
            <SiteProtection enabled={siteGateEnabled} requiredKey={siteAccessKey}>
              <div className="relative flex flex-col h-screen">
                {spendCampaign && spendCampaign.showBanner !== false && (
                  <SpendCampaignBanner campaign={spendCampaign} />
                )}
                <Navbar />
                  <div className="relative flex flex-1 flex-col">
                    <main className="container mx-auto max-w-7xl pt-4 px-6 flex-grow">
                      {children}
                    </main>
                    <Footer />
                  </div>
              </div>
            </SiteProtection>
          </SkuProvider>
        </Providers>
      </body>
    </html>
  );
}
