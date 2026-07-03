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
      {/* Blackout curtain — the first beat of the → dark transition. Fades the
          whole background to solid black FAST (500ms) so the eye-slash intro and
          cloth (both delayed) play against black rather than a half-lit page.
          Sits at the very bottom of the z-0 background stack (painted first), so
          the eye-slash reveal + cloth paint on top of it; the light-mode layers
          render above it but are transparent in dark mode. bg-black, not the
          theme's #0c0a09, for a cleaner blackout — the cloth covers it anyway. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-black opacity-0 transition-opacity duration-500 ease-in-out dark:opacity-100"
      />

      {/* Eye-slash "slashing" intro — dark mode, new-arrivals homepage only.
          Runs on the → dark transition AFTER the blackout above lands. Full
          sequence: blackout → EYE unzips + glints (here) → the surrounding tears
          unzip + glint (next wrapper) → the torn cloth fades in (dark:delay-[2050ms]).
          Two staggered beats here: the eye tear UNZIPS first (eye-reveal, 0.5s
          delay — a chevron clip-path whose apex slides along the eye's midline,
          gaping the slash open behind it), THEN a blade glint sweeps across the
          open eye (eye-glint, 1.0s delay), revealing the neon Kabuki underneath. Its
          revealed content matches the cloth's eye HOLE exactly (same eye
          geometry via mask-size:cover + same Kabuki transforms), so it hands
          off seamlessly once the cloth fades in over it and occludes it.
          Invisible at rest; the animations only fire while `.dark` is applied. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 isolate overflow-hidden"
      >
        {/* Neon Kabuki revealed through the eye — the tear unzips open (a chevron
            clip-path sliding along the midline, intersected with the eye mask).
            Mobile/desktop variants mirror the cloth's eye-hole position +
            Kabuki transforms so the reveal lines up with the tear that follows. */}
        <div
          className="absolute inset-0 opacity-0 dark:animate-eye-reveal md:hidden"
          style={{
            WebkitMaskImage: "url('/eye-slash-mobile.svg')",
            maskImage: "url('/eye-slash-mobile.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-y-0 -left-[38%] right-0 -translate-y-[12%] scale-110 bg-cover bg-center"
            style={{
              backgroundImage: "url('/KabukichoStreet.jpg')",
              filter: "brightness(1.3) saturate(1.3)",
            }}
          />
        </div>
        <div
          className="absolute inset-0 hidden opacity-0 dark:animate-eye-reveal md:block"
          style={{
            WebkitMaskImage: "url('/eye-slash.svg')",
            maskImage: "url('/eye-slash.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-y-0 -left-[20%] right-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/KabukichoStreet.jpg')",
              filter: "brightness(1.3) saturate(1.3)",
            }}
          />
        </div>

        {/* Blade glint — a thin bright diagonal streak sweeping across the eye,
            tracking the slash edge. Masked to the same eye shape so it only
            flashes inside the tear. Painted after the reveal so it sits on top. */}
        <div
          className="absolute inset-0 opacity-0 dark:animate-eye-glint md:hidden"
          style={{
            background:
              "linear-gradient(120deg, rgba(224,255,252,0) 0%, rgba(224,255,252,0.7) 44%, #f2fffe 50%, rgba(224,255,252,0.7) 56%, rgba(224,255,252,0) 100%)",
            filter: "blur(1.5px)",
            mixBlendMode: "screen",
            WebkitMaskImage: "url('/eye-slash-mobile.svg')",
            maskImage: "url('/eye-slash-mobile.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
        <div
          className="absolute inset-0 hidden opacity-0 dark:animate-eye-glint md:block"
          style={{
            background:
              "linear-gradient(120deg, rgba(224,255,252,0) 0%, rgba(224,255,252,0.7) 44%, #f2fffe 50%, rgba(224,255,252,0.7) 56%, rgba(224,255,252,0) 100%)",
            filter: "blur(1.5px)",
            mixBlendMode: "screen",
            WebkitMaskImage: "url('/eye-slash.svg')",
            maskImage: "url('/eye-slash.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      </div>

      {/* Surrounding tears intro — repeats the eye's unzip + glint on the OTHER
          tears AFTER the eye, then hands off to the cloth. Masked to
          ripped-tears.svg (all non-eye tears; one SVG covers both breakpoints).
          Same structure/purpose as the eye-reveal wrapper above, but the reveal
          uses a FULL-VIEWPORT chevron sweep (dark:animate-tears-reveal) since the
          tears are scattered, not a single midline-scoped one. Kabuki children
          match the cloth's base-layer transforms per breakpoint so the revealed
          neon lines up with the cloth's tear holes that fade in after; occluded
          at rest. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 isolate overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-0 dark:animate-tears-reveal"
          style={{
            WebkitMaskImage: "url('/ripped-tears.svg')",
            maskImage: "url('/ripped-tears.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        >
          <div
            className="absolute inset-y-0 -left-[38%] right-0 -translate-y-[12%] scale-110 bg-cover bg-center md:hidden"
            style={{
              backgroundImage: "url('/KabukichoStreet.jpg')",
              filter: "brightness(1.3) saturate(1.3)",
            }}
          />
          <div
            className="absolute inset-y-0 -left-[20%] right-0 hidden bg-cover bg-center md:block"
            style={{
              backgroundImage: "url('/KabukichoStreet.jpg')",
              filter: "brightness(1.3) saturate(1.3)",
            }}
          />
        </div>

        <div
          className="absolute inset-0 opacity-0 dark:animate-tears-glint"
          style={{
            background:
              "linear-gradient(120deg, rgba(224,255,252,0) 0%, rgba(224,255,252,0.7) 44%, #f2fffe 50%, rgba(224,255,252,0.7) 56%, rgba(224,255,252,0) 100%)",
            filter: "blur(1.5px)",
            mixBlendMode: "screen",
            WebkitMaskImage: "url('/ripped-tears.svg')",
            maskImage: "url('/ripped-tears.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      </div>

      {/* Ripped-cloth dark background — dark mode, new-arrivals homepage only.
          A dark torn cloth laid over the Kabukicho street: the neon shows
          through the tears. Hidden in light mode. Its fade-in is delayed
          (dark:delay-[2050ms]) so the blackout, the eye, AND the surrounding
          tears all read first, then the full cloth materializes around them. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 isolate overflow-hidden opacity-0 transition-opacity duration-700 ease-in-out dark:opacity-100 dark:delay-[2050ms]"
      >
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
          className="absolute inset-y-0 -left-[38%] right-0 -translate-y-[12%] scale-110 bg-cover bg-center dark:animate-glow-pulse md:-left-[20%] md:translate-y-0 md:scale-100"
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

      {/* Light-mode torn slashes — the inverse of dark mode: the cream page is
          "torn" and dark fabric shows through the slashes. The tears-only SVG
          (eye slash removed) masks a darkened fabric layer so only the slashes
          paint. Same tear geometry/position as dark mode; one SVG covers both
          breakpoints since the eye slash was the only desktop/mobile diff.
          Mask (outer) and filter (inner) are split onto separate elements to
          avoid stacking mask+filter on one node. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-100 transition-opacity duration-700 ease-in-out dark:opacity-0"
      >
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: "url('/ripped-tears.svg')",
            maskImage: "url('/ripped-tears.svg')",
            WebkitMaskSize: "cover",
            maskSize: "cover",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        >
          {/* Same #0c0a09 cloth base + grain as dark mode, but the grain is
              pushed harder (0.4 vs 0.12) so the weave still reads inside the
              narrow slashes against the bright cream surroundings — at dark
              mode's 0.12 the eye adapts to the surround and it looks flat. */}
          <div className="absolute inset-0" style={{ backgroundColor: "#0c0a09" }}>
            <div
              className="absolute inset-0 bg-repeat"
              style={{
                backgroundImage:
                  "url('https://i.ibb.co/x8tL47Pd/fabric-texture1.png')",
                backgroundSize: "1000px 1000px",
                opacity: 0.4,
                mixBlendMode: "screen",
                filter: "invert(1)",
              }}
            />
          </div>
        </div>
      </div>

      <section className="relative z-10 flex w-full max-w-full flex-col items-center overflow-x-hidden px-4 pb-10 pt-24 sm:pt-10">

        {/* ── Layered "LIFE SUCKS" hero art ────────────────────── */}
        {/* The maroon/pink art is drawn for light garments, so it sits on a
            warm cream plate for contrast. Both PNGs share the same 1080²
            canvas, so stacking them reconstructs the full composition while
            each layer floats independently. */}
        <div className="relative w-full max-w-[520px] animate-fadeIn">
          {/* Soft dark halo behind the character — dark mode only. The torn-cloth
              tears reveal neon right up against her silhouette (busy/glitchy on
              mobile), so a blurred radial pool of the base dark calms the neon
              immediately around her while the framing tears further out still
              show. It's inside the z-10 section, so it paints over the z-0 tear
              layers. Skipped in light mode (a dark blob on cream would be wrong). */}
          <div className="hero-halo pointer-events-none absolute inset-0 -z-10 scale-125 blur-2xl" />

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
          <div className="mt-16 w-full max-w-4xl">
            {/* Subtle scroll prompt — a gently bobbing chevron hinting there's
                more below. Sits over the scene, above the cream panel.
                Decorative, so aria-hidden. */}
            <div
              aria-hidden
              className="mb-16 flex justify-center text-foreground/50"
            >
              <svg
                className="h-6 w-6 animate-scroll-hint"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            {/* Cream panel with a maroon top-border accent — a solid plate that
                lifts the products off the dark scene. Full-bleed to the viewport
                edges via w-screen + a centering margin (breaks out of the
                max-w-4xl / px-4 container), with the products kept in a centered
                max-width container inside. Fill + text colors are fixed (not
                theme-driven) since the panel is always cream, so the dark text
                stays legible in both light and dark mode. */}
            <div className="ml-[calc(50%-50vw)] w-screen border-t-4 border-[#621600] bg-[#f3ede1] py-12 text-[#2a1810]">
              <div className="mx-auto w-full max-w-4xl px-6 sm:px-10">
                <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.25em] text-[#621600]">
                  Also New
                </h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>

                <div className="mt-10 text-center">
                  <Link
                    className="text-sm uppercase tracking-widest text-[#621600]/80 underline-offset-4 hover:underline"
                    href="/store"
                  >
                    View all products
                  </Link>
                </div>
              </div>
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
