import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBundleBySlug } from "@/lib/bundles";
import { urlForImage } from "@/sanity/lib/image";
import { buildMetadata } from "@/lib/seo";
import { BundleBuilder } from "@/components/bundle-builder";
import type { BundleDeal } from "@/types";

// Bundle availability is derived from live Neon stock, so render per request
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);

  if (!bundle) {
    return buildMetadata({
      title: "Bundle not found",
      path: `/store/bundles/${slug}`,
      noindex: true,
    });
  }

  return buildMetadata({
    title: bundle.name,
    description:
      bundle.description ||
      `${bundle.components.map((c) => c.name).join(" + ")} — $${bundle.bundlePrice.toFixed(2)}`,
    path: `/store/bundles/${slug}`,
    image: bundle.mainImage
      ? urlForImage(bundle.mainImage).width(1200).height(630).url()
      : undefined,
  });
}

export default async function BundlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);

  if (!bundle) notFound();

  const gallery = [bundle.mainImage, ...(bundle.images || [])].filter(Boolean);

  return (
    <div className="container mx-auto max-w-7xl px-6 py-12">
      <nav className="mb-8 text-sm text-gray-500 dark:text-gray-400">
        <Link className="hover:underline" href="/store">
          Store
        </Link>
        {" / "}
        <Link className="hover:underline" href="/store/bundles">
          Bundles
        </Link>
        {" / "}
        <span className="text-gray-900 dark:text-gray-100">{bundle.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
            {gallery[0] && (
              <Image
                priority
                fill
                alt={bundle.name}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                src={urlForImage(gallery[0]).width(900).height(900).url()}
              />
            )}
          </div>

          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {gallery.slice(1, 5).map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900"
                >
                  <Image
                    fill
                    alt={`${bundle.name} ${i + 2}`}
                    className="object-cover"
                    sizes="25vw"
                    src={urlForImage(img).width(300).height(300).url()}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Builder */}
        <div>
          <h1 className="text-3xl font-bold mb-6">{bundle.name}</h1>
          <BundleBuilder bundle={bundle as unknown as BundleDeal} />
        </div>
      </div>
    </div>
  );
}
