import Link from "next/link";
import Image from "next/image";
import { groq } from "next-sanity";

import { subtitle } from "@/components/primitives";
import TextureOverlay from "@/components/texture-overlay";
import ThemeInstagram from "@/components/theme-instagram";
import { client } from "@/sanity/lib/client";
import { urlForImage } from "@/sanity/lib/image";

// The two products to spotlight beneath the hero. Change these slugs to
// feature different products — data (price/image/stock) is pulled live.
const FEATURED_SLUGS = ["crash-dummy-hoodie", "yots"];

// Where the hero "Shop the Drop" button points. Set to a product slug
// (e.g. "/store/products/life-sucks-tee") once the item is in the store.
const HERO_CTA_HREF = "/store";

interface FeaturedProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  mainImage?: any;
}

const featuredHomeProductsQuery = groq`*[_type == "product" && slug.current in $slugs]{
  _id,
  name,
  "slug": slug.current,
  price,
  comparePrice,
  inStock,
  mainImage
}`;

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  try {
    const products = await client.fetch<FeaturedProduct[]>(
      featuredHomeProductsQuery,
      { slugs: FEATURED_SLUGS },
    );

    // Preserve the order declared in FEATURED_SLUGS.
    return FEATURED_SLUGS.map((slug) =>
      products.find((p) => p.slug === slug),
    ).filter((p): p is FeaturedProduct => Boolean(p));
  } catch {
    return [];
  }
}

function ProductCard({ product }: { product: FeaturedProduct }) {
  const imageUrl = product.mainImage
    ? urlForImage(product.mainImage).width(1000).height(1000).url()
    : null;
  const onSale =
    product.comparePrice != null && product.comparePrice > product.price;

  return (
    <Link
      className="group block w-full"
      href={`/store/products/${product.slug}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/20 backdrop-blur-sm ring-1 ring-white/10">
        {imageUrl && (
          <Image
            fill
            alt={product.name}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 40vw"
            src={imageUrl}
          />
        )}
        {!product.inStock && (
          <span className="absolute top-3 right-3 bg-black/80 text-white px-2 py-1 text-xs font-semibold rounded">
            Sold Out
          </span>
        )}
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="mb-5 inline-block rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black">
            Shop Now →
          </span>
        </div>
      </div>

      <div className="mt-3 text-center">
        <h3 className="text-lg font-semibold group-hover:underline">
          {product.name}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <span className="font-bold">${product.price}</span>
          {onSale && (
            <span className="text-sm text-gray-400 line-through">
              ${product.comparePrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function NewArrivalsHome() {
  const products = await getFeaturedProducts();

  return (
    <>
      {/* Ripped-cloth dark background — dark mode, new-arrivals homepage only.
          A dark torn cloth laid over the Kabukicho street: the neon shows
          through the tears. Hidden in light mode. */}
      <div aria-hidden className="fixed inset-0 z-0 hidden isolate overflow-hidden dark:block">
        {/* Kabukicho street underneath — shifted ~10% left (wider layer offset
            left so there's no gap on the right) */}
        <div
          className="absolute inset-y-0 -left-[38%] right-0 -translate-y-[12%] scale-110 bg-cover bg-center md:-left-[20%] md:translate-y-0 md:scale-100"
          style={{ backgroundImage: "url('/KabukichoStreet.jpg')" }}
        />
        {/* Neon bloom — a blurred, brightened copy of the street screen-blended
            over the sharp base so the signs bleed light. Sits under the cloth,
            so the glow is revealed through the same tears. Matches the base
            layer's transforms exactly to stay aligned. */}
        <div
          className="absolute inset-y-0 -left-[38%] right-0 -translate-y-[12%] scale-110 animate-glow-pulse bg-cover bg-center md:-left-[20%] md:translate-y-0 md:scale-100"
          style={{
            backgroundImage: "url('/KabukichoStreet.jpg')",
            filter: "blur(7px) brightness(1.35) saturate(1.4)",
            mixBlendMode: "screen",
          }}
        />
        {/* Dark torn cloth on top — tears reveal the street. Mobile uses a
            variant with the eye slash raised (bg framing differs at that width). */}
        <div
          className="absolute inset-0 bg-cover bg-center md:hidden"
          style={{ backgroundImage: "url('/ripped-cloth-mobile.svg')" }}
        />
        <div
          className="absolute inset-0 hidden bg-cover bg-center md:block"
          style={{ backgroundImage: "url('/ripped-cloth.svg')" }}
        />

        {/* Fabric grain confined to the cloth. The flat ripped-cloth SVG doubles
            as an alpha mask (opaque cloth = show grain, transparent tears = hide
            it), so the neon showing through the tears stays clean. Screen + invert
            makes the light-mode fabric texture read as subtle grain on the dark
            cloth. Mobile/desktop mask variants mirror the cloth layers above so
            the tears stay aligned. */}
        <div
          className="absolute inset-0 bg-repeat md:hidden"
          style={{
            backgroundImage:
              "url('https://i.ibb.co/x8tL47Pd/fabric-texture1.png')",
            backgroundSize: "1000px 1000px",
            opacity: 0.12,
            mixBlendMode: "screen",
            filter: "invert(1)",
            WebkitMaskImage: "url('/ripped-cloth-mobile.svg')",
            maskImage: "url('/ripped-cloth-mobile.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
        <div
          className="absolute inset-0 hidden bg-repeat md:block"
          style={{
            backgroundImage:
              "url('https://i.ibb.co/x8tL47Pd/fabric-texture1.png')",
            backgroundSize: "1000px 1000px",
            opacity: 0.12,
            mixBlendMode: "screen",
            filter: "invert(1)",
            WebkitMaskImage: "url('/ripped-cloth.svg')",
            maskImage: "url('/ripped-cloth.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      </div>

      {/* Subtle fabric texture over the base background — light mode only.
          In dark mode the grain lives inside the cloth block above (masked to
          the cloth shape). */}
      <TextureOverlay
        blendMode="multiply"
        className="bg-blend-overlay z-0 dark:hidden"
        opacity={0.25}
        textureUrl="https://i.ibb.co/x8tL47Pd/fabric-texture1.png"
      />

      <section className="relative z-10 flex w-full max-w-full flex-col items-center overflow-x-hidden px-4 pb-10 pt-24 sm:pt-10">

        {/* ── Layered "LIFE SUCKS" hero art ────────────────────── */}
        {/* The maroon/pink art is drawn for light garments, so it sits on a
            warm cream plate for contrast. Both PNGs share the same 1080²
            canvas, so stacking them reconstructs the full composition while
            each layer floats independently. */}
        <div className="relative w-full max-w-[520px] animate-fadeIn">
          {/* Soft glow behind the plate */}
          <div className="absolute inset-0 -z-10 scale-110 rounded-[2rem]  blur-3xl" />

          <div className="relative aspect-square overflow-hidden rounded-[2rem]  sm:p-10">
            <div className="relative h-full w-full">
              <Image
                fill
                priority
                alt="Life Sucks Girl"
                className=" object-contain"
                sizes="(max-width: 640px) 90vw, 520px"
                src="/new-arrivals/lsgirl.png"
              />
              {/* Wrapper carries the upward offset so the float animation on
                  the image itself isn't overridden. Tune -translate-y-[…] to
                  move the "life sucks" text higher/lower. */}
              <div className="absolute inset-0 -translate-y-[29%] sm:-translate-y-[35%]">
                <Image
                  fill
                  priority
                  alt="LS Text"
                  className="animate-float-slow object-contain"
                  sizes="(max-width: 640px) 90vw, 520px"
                  src="/new-arrivals/lstext.png"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Hero CTA */}
        <div className="mt-4 flex flex-col items-center gap-4 text-center">
          <p className={subtitle({ className: "!w-full max-w-md text-center" })}>
            Life Sucks. Wear GS.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-block rounded-lg bg-[#621600] px-8 py-3 font-semibold text-[#f3ede1] transition-transform hover:scale-105"
              href={HERO_CTA_HREF}
            >
              Shop
            </Link>
            <Link
              className="inline-block rounded-lg border border-foreground/30 px-8 py-3 font-semibold transition-colors hover:bg-foreground/10"
              href="https://www.instagram.com/gsdesignresearch/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Follow @gsdesignresearch
            </Link>
          </div>
        </div>

        {/* ── Also new: two featured products ──────────────────── */}
        {products.length > 0 && (
          <div className="mt-14 w-full max-w-4xl">
            <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.25em] text-foreground/70">
              Also New
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                className="text-sm uppercase tracking-widest text-foreground/70 underline-offset-4 hover:underline"
                href="/store"
              >
                View all products
              </Link>
            </div>
          </div>
        )}

        {/* Instagram Link */}
        <div className="mt-28 bottom-4">
          <Link
            aria-label="Follow us on Instagram"
            className="p-2 rounded-full transition-colors hover:bg-foreground/10 flex items-center justify-center"
            href="https://www.instagram.com/gsdesignresearch/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ThemeInstagram size={24} />
          </Link>
        </div>
      </section>
    </>
  );
}
