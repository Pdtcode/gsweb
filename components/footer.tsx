import Link from "next/link";

import { InstagramIcon, SoundCloudIcon } from "@/components/icons";
import { siteConfig } from "@/config/site";

const linkClass =
  "uppercase tracking-widest underline-offset-4 transition-opacity hover:underline hover:opacity-70";

export function Footer() {
  return (
    // relative + z-10: the homepage paints fixed background layers at z-0
    <footer className="relative z-10 mt-auto w-full bg-[#621600] px-6 py-8 text-xs text-[#f3ede1]">
      <nav
        aria-label="Footer"
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
      >
        <Link className={linkClass} href="/store">
          Store
        </Link>
        <Link className={linkClass} href="/about">
          About
        </Link>
        <Link className={linkClass} href="/contact">
          Contact
        </Link>
      </nav>
      <div className="mt-4 flex items-center justify-center gap-x-5">
        <a
          aria-label="Instagram"
          className="transition-opacity hover:opacity-70"
          href="https://www.instagram.com/gsdesignresearch/"
          rel="noopener noreferrer"
          target="_blank"
        >
          <InstagramIcon aria-hidden size={20} />
        </a>
        <a
          aria-label="G$ Mafia on SoundCloud"
          className="transition-opacity hover:opacity-70"
          href="https://on.soundcloud.com/nPeYc7Koz9J7MBEy8T"
          rel="noopener noreferrer"
          target="_blank"
        >
          <SoundCloudIcon aria-hidden size={24} />
        </a>
      </div>
      <p className="mt-4 text-center">
        © {new Date().getFullYear()} {siteConfig.name}
      </p>
    </footer>
  );
}
