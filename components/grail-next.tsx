"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// The end of the story so far: a line draws across, then the Coming Soon art
// arrives. Both PNGs share the same 1080² canvas, so stacking them rebuilds the
// composition while the words float. Visible by default and only hidden once
// JavaScript runs, so the content never depends on the animation.
export default function GrailNext() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;

    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      element.getBoundingClientRect().top < window.innerHeight * 0.6
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
    <div ref={ref} className="grail-next">
      <div aria-hidden className="grail-end-line" />
      <p className="grail-end-label">To be continued</p>
      <div className="grail-next-art">
        <Image
          fill
          alt="Life Sucks girl eating a popsicle"
          className="grail-next-girl object-contain"
          sizes="(max-width: 640px) 68vw, 480px"
          src="/new-arrivals/lsgirl.png"
        />
        <div className="grail-next-words">
          <Image
            fill
            alt="Life Sucks"
            className="animate-float-slow object-contain"
            sizes="(max-width: 640px) 68vw, 480px"
            src="/new-arrivals/lstext.png"
          />
        </div>
      </div>
      <p className="grail-next-label">Coming Soon</p>
    </div>
  );
}
