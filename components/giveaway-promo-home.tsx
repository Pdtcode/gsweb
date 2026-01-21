"use client";

import Link from "next/link";

import { title } from "@/components/primitives";
import ThemeBackground from "@/components/theme-background";
import TextureOverlay from "@/components/texture-overlay";
import ThemeInstagram from "@/components/theme-instagram";
import ProductCarousel from "@/components/product-carousel";

// Add your product images here (use i.ibb.co, cdn.sanity.io, or lh3.googleusercontent.com)
const carouselImages = [
  { src: "https://cdn.sanity.io/images/arbp7h2s/production/7a8816fd50aea0a18182350303d536cae319bc5a-2048x2048.jpg", alt: "Product 1" },
  { src: "https://cdn.sanity.io/images/arbp7h2s/production/24fd65020c95709a699409753e579922a13ad789-1024x1024.jpg", alt: "Product 2" },
  { src: "https://cdn.sanity.io/images/arbp7h2s/production/77cd18bf1df5bfccefc52599961fbbf14b269aa3-2048x2048.jpg", alt: "Product 3" },
  { src: "https://cdn.sanity.io/images/arbp7h2s/production/f87fafd486b4a2bd5aaf53706894bb3faf9ec9c8-1206x1206.jpg", alt: "Product 4" },
];

export default function GiveawayPromoHome() {
  return (
    <>
      {/* Background Image - Only on homepage */}
      <ThemeBackground
        darkImageUrl="https://i.ibb.co/7t0Gm7LX/trans-upscalegs-1000.png"
        lightImageUrl="https://i.ibb.co/5h9m9R6J/trans-invert-2-upscalegs-1000.png"
        opacity={0.6}
      />

      {/* Texture Overlay */}
      <TextureOverlay
        blendMode="multiply"
        className="bg-blend-overlay z-10"
        opacity={0.3}
        textureUrl="https://i.ibb.co/x8tL47Pd/fabric-texture1.png"
      />

      <section className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="flex flex-col items-center justify-center text-center max-w-2xl">

          {/* Giveaway CTA Card */}
          <div className="mt-8 p-6 md:p-8 rounded-2xl bg-black/70 backdrop-blur-sm text-white shadow-2xl w-full max-w-xl">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
              GIVEAWAY
            </span>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Win a Trip to Japan!
            </h2>

            <ProductCarousel images={carouselImages} autoPlayInterval={4000} />

            <p className="text-white/90 mb-6 text-sm md:text-sm">
              Shop $80 or more for a chance to win a free round trip to Japan. Crash Dummy Hoodies give you 6x entries! Be sure to give us a follow too!
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/store"
                className="inline-block px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-center"
              >
                Shop Now
              </Link>
              <Link
                href="https://instagram.com/gsdesignresearch"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors text-center"
              >
                Follow @gsdesignresearch
              </Link>
            </div>

            <p className="text-white/70 text-xs mt-4">
              Must be 21+ with valid passport. US residents only. Winner announced Feb 9.
            </p>
          </div>
        </div>

        {/* Instagram Link */}
        <div className="fixed bottom-4 hidden">
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
