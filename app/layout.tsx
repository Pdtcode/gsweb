import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans, fontUDMincho } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import SiteProtection from "@/components/site-protection";
import { SkuProvider } from "@/lib/contexts/sku-context";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
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
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontUDMincho.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
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
