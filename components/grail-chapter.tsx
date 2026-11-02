"use client";

import type { CSSProperties } from "react";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import GrailVideo from "@/components/grail-video";
import type { GrailChapter as Chapter, GrailMedia, GrailVideoMedia } from "@/lib/grails";

function isVideo(media: GrailMedia): media is GrailVideoMedia {
  return "videoUrl" in media;
}

// Photo rotation. Each gallery runs on its own clock from page load, whether or
// not it's on screen, and quick enough to catch while scrolling past. Every
// chapter has its own pace and first delay, so galleries don't change in step.
const rotationPace = (number: number) => 2600 + number * 310;
const rotationFirstDelay = (number: number) => 1300 + number * 470;

// One full-screen chapter. Its entrance animation plays once, when it scrolls
// into view. Chapters are visible by default and only hidden once JavaScript
// runs, so the content never depends on the animation.
export default function GrailChapterView({
  chapter,
  number,
  flip,
}: {
  chapter: Chapter;
  // Its place in the story, which sets its photo rotation timing
  number: number;
  flip: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const lead = chapter.media[0];
  const { link } = chapter;
  const photoCount = chapter.media.filter((item) => !isVideo(item)).length;

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
      { threshold: 0.25 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      photoCount < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const advance = () =>
      setActive((current) => (current + 1) % chapter.media.length);
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      advance();
      interval = window.setInterval(advance, rotationPace(number));
    }, rotationFirstDelay(number));

    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [number, photoCount, chapter.media.length]);

  const classes = [
    "grail-chapter",
    chapter.wide ? "grail-chapter--wide" : "",
    // Tall enough to fill an upright screen without much cropping
    isVideo(lead) && lead.height > lead.width ? "grail-chapter--tall" : "",
    flip ? "grail-chapter--flip" : "",
  ].join(" ");
  // The box keeps the lead's shape, so rotating photos never shifts the page
  const ratio = { "--ratio": lead.width / lead.height } as CSSProperties;

  return (
    <article ref={ref} className={classes} id={chapter.id} style={ratio}>
      {/* Upright screens only: a blurred copy fills the screen around the picture */}
      <div aria-hidden className="grail-backdrop">
        {chapter.media.map((item, index) => {
          const src = isVideo(item) ? item.posterUrl : item.url;

          return src ? (
            <Image
              key={src}
              fill
              alt=""
              className={index === active ? "is-active" : ""}
              quality={40}
              sizes="40vw"
              src={src}
            />
          ) : null;
        })}
      </div>

      <div className="grail-media">
        {chapter.media.map((item, index) =>
          isVideo(item) ? (
            <GrailVideo
              key={item.videoUrl}
              label={item.label}
              poster={item.posterUrl}
              src={item.videoUrl}
            />
          ) : (
            <Image
              key={item.url}
              fill
              alt={item.alt}
              aria-hidden={index !== active || undefined}
              className={`grail-photo ${index === active ? "is-active" : ""}`}
              quality={90}
              sizes="(orientation: portrait) 100vw, 60vw"
              src={item.url}
            />
          ),
        )}
      </div>

      <div className="grail-copy">
        <h3 className="grail-headline">{chapter.headline}</h3>
        {chapter.quote && (
          <p className="grail-quote">“{chapter.quote}”</p>
        )}
        {chapter.intro && <p className="grail-intro">{chapter.intro}</p>}
        {link &&
          (link.external ? (
            <a
              className="grail-link"
              href={link.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              {link.label} →
            </a>
          ) : (
            <Link className="grail-link" href={link.href}>
              {link.label} →
            </Link>
          ))}
      </div>
    </article>
  );
}
