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

export function BundleCard({ bundle }: { bundle: BundleCardData }) {
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
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={productImageUrl(bundle.mainImage, 600, bundle.imageDisplay)}
          />
        )}

        <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded bg-black text-white dark:bg-white dark:text-black">
          Bundle
        </span>

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
        <h3 className="font-medium">{bundle.name}</h3>
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
}
