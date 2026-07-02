import type { MetadataRoute } from "next";

import { client } from "@/sanity/lib/client";
import { siteUrl } from "@/lib/seo";

// Refresh the sitemap hourly so newly published products/posts appear.
export const revalidate = 3600;

interface SitemapEntity {
  slug: string;
  updatedAt?: string;
}

async function safeFetch(query: string): Promise<SitemapEntity[]> {
  try {
    const rows = await client.fetch<
      { slug?: { current?: string }; updatedAt?: string }[]
    >(query);

    return rows
      .filter((r) => r?.slug?.current)
      .map((r) => ({ slug: r.slug!.current!, updatedAt: r.updatedAt }));
  } catch {
    // Never let a Sanity hiccup break the sitemap — return static routes only.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections, posts] = await Promise.all([
    safeFetch(
      `*[_type == "product" && dropExclusive != true && defined(slug.current)]{ slug, "updatedAt": _updatedAt }`,
    ),
    safeFetch(
      `*[_type == "collection" && defined(slug.current)]{ slug, "updatedAt": _updatedAt }`,
    ),
    safeFetch(
      `*[_type == "post" && defined(slug.current)]{ slug, "updatedAt": _updatedAt }`,
    ),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/store`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/drop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/news`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/contact`, changeFrequency: "yearly", priority: 0.4 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${siteUrl}/store/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${siteUrl}/store/collections/${c.slug}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${siteUrl}/news/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...collectionRoutes,
    ...postRoutes,
  ];
}
