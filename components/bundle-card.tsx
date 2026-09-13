import Image from "next/image";
import Link from "next/link";

import { productImageUrl } from "@/lib/product-image";

// Structural shape shared by the storefront listing and the store page.
// Kept loose so both the server-resolved bundle and its serialized form fit.
export interface BundleCardData {
  _id: string;
  name: string;
  slug: { current: string };
  mainImage?: any;
  imageDisplay?: any;
  bundlePrice: number;
  componentSum: number;
  savings: number;
  maxBundles: number;
  components: { name: string; quantity: number }[];
}

export function BundleCard({
  bundle,
  compact = false,
}: {
  bundle: BundleCardData;
  // Compact is used where bundles sit alongside product cards, so they read
  // as peers rather than dominating the row.
  compact?: boolean;
}) {
  const soldOut = bundle.maxBundles <= 0;

  return (
    <Link
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
            sizes={
              compact
                ? "(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            }
            src={productImageUrl(bundle.mainImage, 600, bundle.imageDisplay)}
          />
        )}

        <span
          className={`absolute ${compact ? "top-2 right-2 text-[9px] px-1.5 py-0.5" : "top-3 right-3 text-[10px] px-2 py-1"} font-semibold uppercase tracking-wide rounded bg-black text-white dark:bg-white dark:text-black`}
        >
          Bundle
        </span>

        {bundle.savings > 0 && !soldOut && (
          <span
            className={`absolute ${compact ? "top-2 left-2 text-[10px] px-1.5 py-0.5" : "top-3 left-3 text-xs px-2 py-1"} font-semibold rounded bg-green-600 text-white`}
          >
            Save ${bundle.savings.toFixed(2)}
          </span>
        )}
        {soldOut && (
          <span
            className={`absolute ${compact ? "top-2 left-2 text-[10px] px-1.5 py-0.5" : "top-3 left-3 text-xs px-2 py-1"} font-semibold rounded bg-gray-800 text-white`}
          >
            Sold out
          </span>
        )}
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        <h3 className={compact ? "font-medium text-sm" : "font-medium"}>
          {bundle.name}
        </h3>
        <p
          className={`mt-1 text-gray-500 dark:text-gray-400 ${compact ? "text-xs line-clamp-2" : "text-sm"}`}
        >
          {bundle.components
            .map((c) => (c.quantity > 1 ? `${c.quantity}× ${c.name}` : c.name))
            .join(" + ")}
        </p>
        <div className={`flex items-baseline gap-2 ${compact ? "mt-2" : "mt-3"}`}>
          <span className={compact ? "text-base font-bold" : "text-lg font-bold"}>
            ${bundle.bundlePrice.toFixed(2)}
          </span>
          {bundle.savings > 0 && (
            <span
              className={`text-gray-500 line-through ${compact ? "text-xs" : "text-sm"}`}
            >
              ${bundle.componentSum.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
