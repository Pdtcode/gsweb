"use client";

import { useEffect, useRef } from "react";

// A silent loop with no controls. It starts a little before it scrolls on screen
// and keeps going a little after it leaves, so it's already moving when seen,
// and pauses otherwise. Stays on its poster for visitors who prefer reduced
// motion or have data saver on.
export default function GrailVideo({
  src,
  poster,
  label,
  decorative = false,
}: {
  src: string;
  poster?: string | null;
  label: string;
  decorative?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    if (
      !video ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      connection?.saveData
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // A rejected play (e.g. low power mode) just leaves the poster up
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "35% 0px" },
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="grail-video">
      <video
        ref={ref}
        disablePictureInPicture
        loop
        muted
        playsInline
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : label}
        poster={poster ?? undefined}
        preload="none"
        src={src}
      />
    </div>
  );
}
