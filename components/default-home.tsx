import Link from "next/link";

import { title } from "@/components/primitives";
import ThemeBackground from "@/components/theme-background";
import TextureOverlay from "@/components/texture-overlay";
import ThemeInstagram from "@/components/theme-instagram";

export default function DefaultHome() {
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
      <section className="relative z-10 flex flex-col items-center justify-center max-h-screen">
        <div className="flex flex-col mt-60 items-center justify-center">
          <div className="flex items-center max-w-xl text-center justify-center">
            <span className={title()}>SEEK TILL YOU FIND</span>
          </div>
        </div>
        <div className=" fixed bottom-4">
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
