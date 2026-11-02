"use client";

import { useEffect, useRef } from "react";

import { InstagramIcon } from "@/components/icons";

// The call to action after Coming Soon: follow along on Instagram. Visible by
// default and only hidden once JavaScript runs, so it never depends on the
// animation.
export default function GrailJoin() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      element.getBoundingClientRect().top < window.innerHeight * 0.85
    ) {
      return;
    }

    element.dataset.reveal = "out";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.reveal = "in";
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="grail-join">
      <h2 className="grail-join-headline">Become a Seeker</h2>
      <p className="grail-join-line">
        Drops, stories and everything in between. Follow the search on
        Instagram.
      </p>
      <a
        className="grail-join-button"
        href="https://www.instagram.com/gsdesignresearch/"
        rel="noopener noreferrer"
        target="_blank"
      >
        <InstagramIcon aria-hidden size={20} />
        Follow @gsdesignresearch
      </a>
      <button
        className="grail-to-top"
        type="button"
        onClick={() => {
          const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;

          window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        }}
      >
        Back to top ↑
      </button>
    </div>
  );
}
