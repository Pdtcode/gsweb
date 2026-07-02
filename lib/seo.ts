import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export { siteConfig };

/**
 * Canonical production origin. Configurable via NEXT_PUBLIC_SITE_URL so the
 * same build can target preview/staging domains without code changes.
 * Falls back to the production domain, then localhost for local dev.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://gsdesignresearch.com"
).replace(/\/$/, "");

/** Default social-share image (1200x630 recommended). Lives in /public. */
export const defaultOgImage = "/drop-fallback-image.jpg";

/** Brand keywords that describe the business for search engines. */
export const siteKeywords = [
  "Grail Seekers",
  "streetwear",
  "limited edition apparel",
  "streetwear drops",
  "exclusive hoodies",
  "graphic tees",
  "curated collections",
  "hype apparel",
  "streetwear brand",
];

/** Turn a root-relative path into an absolute URL against the canonical origin. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

interface PageMetaInput {
  title?: string;
  description?: string;
  /** Root-relative canonical path, e.g. "/store". */
  path?: string;
  /** Absolute image URL (e.g. a Sanity CDN url) or root-relative path. */
  image?: string | null;
  type?: "website" | "article";
  /** When true, tell crawlers not to index this page. */
  noindex?: boolean;
  keywords?: string[];
  publishedTime?: string;
  authors?: string[];
}

/**
 * Build a fully-populated Metadata object (canonical + OpenGraph + Twitter)
 * for a page, layered on top of the root layout defaults.
 */
export function buildMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  image,
  type = "website",
  noindex = false,
  keywords,
  publishedTime,
  authors,
}: PageMetaInput): Metadata {
  const canonical = absoluteUrl(path);
  const ogImage = image
    ? /^https?:\/\//.test(image)
      ? image
      : absoluteUrl(image)
    : absoluteUrl(defaultOgImage);

  const resolvedTitle = title ?? siteConfig.name;

  return {
    title,
    description,
    keywords: keywords ?? siteKeywords,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type,
      url: canonical,
      title: resolvedTitle,
      description,
      siteName: siteConfig.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: resolvedTitle }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(authors ? { authors } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description,
      images: [ogImage],
    },
  };
}

/** Serialize a JSON-LD object for injection into a <script> tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
