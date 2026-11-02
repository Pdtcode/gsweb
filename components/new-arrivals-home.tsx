import Link from "next/link";
import Image from "next/image";
import { groq } from "next-sanity";

import TextureOverlay from "@/components/texture-overlay";
import BtdVideo from "@/components/btd-video";
import GrailsSection from "@/components/grails-section";
import SwipeCardStack from "@/components/swipe-card-stack";
import {
  BtdTimelineProvider,
  TimelineImage,
  TimelineSparks,
} from "@/components/btd-timeline";
import { client } from "@/sanity/lib/client";
import { urlForImage } from "@/sanity/lib/image";

// The two products to spotlight beneath the hero. Change these slugs to
// feature different products — data (price/image/stock) is pulled live.
const FEATURED_SLUGS = ["life-sucks-trucker-hat", "gs-x-han-jan-collab"];

// Vertical "behind the design" clip for the GS x Han Jan collab, shown beside
// the featured products. Served from /public.
const BTD_VIDEO_SRC = "/btd.mp4";
// Frame grabbed at 5.0s — the "BEHIND THE DESIGN" title card.
const BTD_POSTER_SRC = "/btd-poster.jpg";

// Desktop only: while the video plays, this product's photo follows it —
// front (main image) until the first cue, then its gallery images in order:
// the shirt's back at 0:04 (as the "BEHIND THE DESIGN" title lands), the
// artwork at 0:35. Back to the front when the video ends. The gallery order
// in the Studio is what decides which photo shows at each cue.
const BTD_PRODUCT_SLUG = "gs-x-han-jan-collab";

const BTD_PHOTO_CUES = [4, 35];

interface FeaturedProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  mainImage?: any;
  imageDisplay?: any;
  images?: any[];
}

// A product retired in the Studio drops out of the homepage too. The slugs
// below are hand-picked, so without this a hidden product would keep its
// spot here long after it vanished from the store.
const featuredHomeProductsQuery = groq`*[_type == "product" && slug.current in $slugs && isActive != false]{
  _id,
  name,
  "slug": slug.current,
  price,
  comparePrice,
  description,
  inStock,
  mainImage,
  imageDisplay,
  images
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

const heroPrimaryButton =
  "inline-block bg-[#621600] px-7 py-3.5 text-center text-sm font-semibold uppercase tracking-widest text-[#f3ede1] transition-opacity hover:opacity-85";

function ViewAllLink() {
  return (
    <Link
      className="text-sm uppercase tracking-widest text-[#621600] underline underline-offset-4 hover:opacity-70 dark:text-[#f3ede1]"
      href="/store"
    >
      View all products
    </Link>
  );
}

// Homepage-only cutouts of the collab shirt, so it sits on the site's own
// background. The store and product pages keep the Studio's photos. Front first,
// then one image per BTD_PHOTO_CUES cue.
const HERO_CUTOUTS = [
  "/grails/collab-front.webp",
  "/grails/collab-back.webp",
  "/grails/collab-art.webp",
];

function HeroPhoto({
  product,
  syncWithVideo = false,
  className = "",
}: {
  product: FeaturedProduct;
  // Swap the photo in step with the behind-the-design video (desktop).
  syncWithVideo?: boolean;
  className?: string;
}) {
  return (
    <Link
      className={`group relative block ${className}`}
      href={`/store/products/${product.slug}`}
    >
      {/* Outer box is unclipped so the video-synced sparks can fly past the
          photo's edges; the inner one clips the hover zoom. */}
      <div className="absolute inset-3 overflow-hidden md:inset-6">
        {syncWithVideo ? (
          <TimelineImage
            alt={product.name}
            className="object-contain group-hover:scale-105"
            sizes="(max-width: 1024px) 60vw, 40vw"
            srcs={HERO_CUTOUTS}
          />
        ) : (
          <Image
            fill
            priority
            alt={product.name}
            className="object-contain transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 80vw, 40vw"
            src={HERO_CUTOUTS[0]}
          />
        )}
      </div>
      {!product.inStock && (
        <span className="absolute right-3 top-3 bg-black/80 px-2 py-1 text-xs font-semibold text-white">
          Sold Out
        </span>
      )}
      {syncWithVideo && <TimelineSparks />}
    </Link>
  );
}

// The call to action. Follows the theme, like the stage behind it.
function HeroCopy({
  product,
  compact = false,
}: {
  product: FeaturedProduct;
  // The swipe deck's card is small: no description, and centered.
  compact?: boolean;
}) {
  const onSale =
    product.comparePrice != null && product.comparePrice > product.price;

  return (
    <div className={compact ? "text-center" : ""}>
      {product.inStock && (
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#621600] dark:text-[#f3ede1]">
          Featured
        </p>
      )}
      <h2
        className={`mt-2 font-udmincho font-semibold uppercase leading-[1.05] ${
          compact ? "text-2xl" : "text-3xl lg:text-5xl"
        }`}
      >
        {product.name}
      </h2>
      {!compact && product.description && (
        <p className="hero-description mt-3 leading-relaxed">
          {product.description}
        </p>
      )}
      <p className={`font-bold ${compact ? "mt-1 text-lg" : "mt-3 text-2xl"}`}>
        ${product.price}
        {onSale && (
          <span className="ml-2 text-base font-normal line-through opacity-60">
            ${product.comparePrice}
          </span>
        )}
      </p>
      <Link
        className={`${heroPrimaryButton} ${compact ? "mt-3 w-full" : "mt-5"}`}
        href={`/store/products/${product.slug}`}
      >
        {product.inStock ? "Buy the shirt so I can afford a gf" : "See the collab"}
      </Link>
      <div className={compact ? "mt-3" : "mt-5"}>
        <ViewAllLink />
      </div>
    </div>
  );
}

export default async function NewArrivalsHome() {
  const products = await getFeaturedProducts();
  // The hero sells one shirt: the collab, while it's live.
  const heroProduct =
    products.find((p) => p.slug === BTD_PRODUCT_SLUG) ?? products[0];

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
        className="pointer-events-none fixed inset-0 h-[var(--app-height)] z-0 bg-black opacity-0 transition-opacity duration-500 ease-in-out dark:opacity-100"
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
        className="pointer-events-none fixed inset-0 h-[var(--app-height)] z-0 isolate overflow-hidden"
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
        className="pointer-events-none fixed inset-0 h-[var(--app-height)] z-0 isolate overflow-hidden"
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
        className="pointer-events-none fixed inset-0 h-[var(--app-height)] z-0 isolate overflow-hidden opacity-0 transition-opacity duration-700 ease-in-out dark:opacity-100 dark:delay-[2050ms]"
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
        className="pointer-events-none fixed inset-0 h-[var(--app-height)] z-0 overflow-hidden opacity-100 transition-opacity duration-700 ease-in-out dark:opacity-0"
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

      {/* Phones: the swipe deck on the page's scene. Larger screens: a full-width
          stage. The body clips the 100vw overflow (see .grails in globals.css). */}
      <section className="relative z-10 flex w-full max-w-full flex-col items-center overflow-x-hidden px-4 pb-10 md:-mt-4 md:ml-[calc(50%-50vw)] md:w-screen md:max-w-none md:overflow-visible md:p-0">
        {/* Visually hidden: the page is image-led, so this is its heading for
            search engines and screen readers */}
        <h1 className="sr-only">
          Grail Seekers: Limited-Edition Streetwear by GS Design Research
        </h1>

        {heroProduct && (
          <div className="w-full max-w-6xl pt-8 text-[#2a1810] sm:pt-10 md:max-w-none md:bg-[#f3ede1] md:pt-0 dark:text-[#f3ede1] md:dark:bg-[#160c08]">
            {/* Phones: a swipeable deck, the shirt on top and the
                behind-the-design video peeking out behind it. Height-aware
                width: capped at (viewport height − ~290px) tall, so the dots
                and hint land on the first screen, with a floor so short
                screens stay usable. */}
            <SwipeCardStack
              className="mx-auto w-full max-w-[max(280px,calc((100svh-290px)*9/16))] md:hidden"
              labels={[heroProduct.name, "Behind the Design"]}
            >
              <div className="flex h-full w-full flex-col overflow-hidden border-t-4 border-[#621600] bg-[#f3ede1] dark:bg-[#160c08]">
                <HeroPhoto className="min-h-0 flex-1" product={heroProduct} />
                <div className="p-4">
                  <HeroCopy compact product={heroProduct} />
                </div>
              </div>
              <BtdVideo
                className="h-full w-full"
                label="Behind the design: GS x Han Jan"
                poster={BTD_POSTER_SRC}
                src={BTD_VIDEO_SRC}
              />
            </SwipeCardStack>

            {/* Larger screens: the video at its own 9:16 shape, then the shirt,
                then the call to action, filling the first screen. */}
            <BtdTimelineProvider cues={BTD_PHOTO_CUES}>
              <div className="hidden md:grid md:h-[clamp(440px,calc(100svh-4rem),860px)] md:grid-cols-[auto_1fr]">
                <BtdVideo
                  className="aspect-[9/16] h-full"
                  label="Behind the design: GS x Han Jan"
                  poster={BTD_POSTER_SRC}
                  src={BTD_VIDEO_SRC}
                />

                <div className="hero-stage flex min-h-0 min-w-0 flex-col">
                  <HeroPhoto
                    syncWithVideo
                    className="min-h-0 flex-1"
                    product={heroProduct}
                  />
                  <div className="hero-cta flex items-center p-6 lg:p-10">
                    <HeroCopy product={heroProduct} />
                  </div>
                </div>
              </div>
            </BtdTimelineProvider>
          </div>
        )}
      </section>

      {/* The story, ending on what's coming next. Full bleed, so outside the section */}
      <GrailsSection />
    </>
  );
}
