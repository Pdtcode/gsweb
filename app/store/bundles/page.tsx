import type { Metadata } from "next";

import Link from "next/link";

import { getActiveBundles } from "@/lib/bundles";
import { buildMetadata } from "@/lib/seo";
import { BundleCard } from "@/components/bundle-card";
import { title } from "@/components/primitives";

// Bundle availability is derived from live Neon stock, so render per request
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Bundle Deals",
  description:
    "Save when you buy together — curated Grail Seekers bundles at a lower price than buying each piece separately.",
  path: "/store/bundles",
});

export default async function BundlesPage() {
  const bundles = await getActiveBundles();

  return (
    <div className="container mx-auto max-w-7xl px-6 py-12">
      <h1 className={`${title({ size: "md" })} mb-10`}>Bundle Deals</h1>

      {bundles.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No bundle deals right now. Check back soon.
          </p>
          <Link className="mt-4 inline-block underline" href="/store">
            Browse the store
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {bundles.map((bundle) => (
            <BundleCard key={bundle._id} bundle={bundle} />
          ))}
        </div>
      )}
    </div>
  );
}
