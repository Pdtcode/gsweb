import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import { getActiveBundles } from "@/lib/bundles";
import { urlForImage } from "@/sanity/lib/image";
import { buildMetadata } from "@/lib/seo";
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
      <div className="mb-10">
        <h1 className={title({ size: "md" })}>Bundle Deals</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          Buy together, pay less. Pick your sizes at checkout.
        </p>
      </div>

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
          {bundles.map((bundle) => {
            const soldOut = bundle.maxBundles <= 0;

            return (
              <Link
                key={bundle._id}
                className="group block border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                href={`/store/bundles/${bundle.slug.current}`}
              >
                <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
                  {bundle.mainImage && (
                    <Image
                      fill
                      alt={bundle.name}
                      className={`object-cover transition-transform group-hover:scale-105 ${
                        soldOut ? "opacity-50" : ""
                      }`}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      src={urlForImage(bundle.mainImage).width(600).height(600).url()}
                    />
                  )}
                  {bundle.savings > 0 && !soldOut && (
                    <span className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded bg-green-600 text-white">
                      Save ${bundle.savings.toFixed(2)}
                    </span>
                  )}
                  {soldOut && (
                    <span className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded bg-gray-800 text-white">
                      Sold out
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="font-medium">{bundle.name}</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {bundle.components
                      .map((c) => (c.quantity > 1 ? `${c.quantity}× ${c.name}` : c.name))
                      .join(" + ")}
                  </p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-bold">
                      ${bundle.bundlePrice.toFixed(2)}
                    </span>
                    {bundle.savings > 0 && (
                      <span className="text-sm text-gray-500 line-through">
                        ${bundle.componentSum.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
