import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import { InstagramIcon, SoundCloudIcon } from "@/components/icons";
import { title } from "@/components/primitives";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Grail Seekers is a streetwear brand from GS Design Research in Oklahoma City, making limited-edition apparel released in drops and curated collections.",
  path: "/about",
});

const inlineLinkClass = "underline underline-offset-4 hover:text-foreground/70";
const socialLinkClass =
  "inline-flex items-center gap-2 transition-colors hover:text-foreground/70";

export default function AboutPage() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 py-12 md:grid-cols-2 md:gap-12">
      <Image
        priority
        alt="Lex sitting on a black leather couch in a brick-walled room, with a large bottle of Jägermeister on the table"
        className="h-auto w-full"
        height={1600}
        sizes="(max-width: 768px) 100vw, 560px"
        src="/grails/about-lex.webp"
        width={1600}
      />
      <div className="min-w-0">
      <h1 className={title()}>About Grail Seekers</h1>
      <div className="mt-8 space-y-5 text-base leading-relaxed">
        <p>
          Grail Seekers is a streetwear brand from GS Design Research, based
          in Oklahoma City.
        </p>
        <p>
          We make limited-edition apparel, released in drops and curated
          collections. A grail is the piece you keep looking for, which is where
          our motto comes from: seek until you find.
        </p>
        <p>
          We also work with people we like. The{" "}
          <Link
            className={inlineLinkClass}
            href="/store/products/gs-x-han-jan-collab"
          >
            GS x Han Jan Collab
          </Link>{" "}
          celebrates Han Jan Pocha Kitchen&apos;s two-year anniversary.
        </p>
        <p>
          See what&apos;s available in the{" "}
          <Link className={inlineLinkClass} href="/store">
            store
          </Link>
          . For questions or collaborations,{" "}
          <Link className={inlineLinkClass} href="/contact">
            get in touch
          </Link>
          .
        </p>
      </div>
      <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-base">
        <li>
          <a
            aria-label="@gsdesignresearch on Instagram"
            className={socialLinkClass}
            href="https://www.instagram.com/gsdesignresearch/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <InstagramIcon aria-hidden size={24} />
            @gsdesignresearch
          </a>
        </li>
        <li>
          <a
            aria-label="G$ Mafia on SoundCloud"
            className={socialLinkClass}
            href="https://on.soundcloud.com/nPeYc7Koz9J7MBEy8T"
            rel="noopener noreferrer"
            target="_blank"
          >
            <SoundCloudIcon aria-hidden size={24} />
            G$ Mafia
          </a>
        </li>
      </ul>
      </div>
    </div>
  );
}
