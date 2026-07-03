import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans, fontUDMincho } from "@/config/fonts";
import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";
import { Navbar } from "@/components/navbar";
import SiteProtection from "@/components/site-protection";
import { SkuProvider } from "@/lib/contexts/sku-context";
import { JsonLd } from "@/components/json-ld";
import {
  absoluteUrl,
  defaultOgImage,
  siteKeywords,
  siteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} — ${siteConfig.description}`,
    template: `%s - ${siteConfig.name}`,
  },
  description:
    "Grail Seekers is a streetwear brand built around limited-edition drops and curated collections. Shop exclusive apparel — hoodies, tees, and accessories — with fast shipping or local pickup.",
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
      "Limited-edition streetwear drops and curated collections. Seek until you find.",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.description}`,
    description:
      "Limited-edition streetwear drops and curated collections. Seek until you find.",
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
  url: siteUrl,
  logo: absoluteUrl("/logo-light.svg"),
  description: siteConfig.description,
  slogan: siteConfig.description,
  sameAs: ["https://www.instagram.com/gsdesignresearch/"],
};

const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/store?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <SiteProtection>
              <div className="relative flex flex-col h-screen">
                <Navbar />
                  <div className="relative flex-1">
                    <main className="container mx-auto max-w-7xl pt-4 px-6 flex-grow">
                      {children}
                    </main>
                  </div>
              </div>
            </SiteProtection>
          </SkuProvider>
        </Providers>
      </body>
    </html>
  );
}
