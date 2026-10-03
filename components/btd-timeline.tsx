"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Syncs the behind-the-design video with other elements on the page: the
// video reports its playback time, and anything inside the provider can react
// to which "stage" of the timeline it's in. Stage = how many cue points the
// playhead has passed, so cues [5, 35] give stage 0 before 0:05, 1 from 0:05,
// 2 from 0:35. Seeking backwards moves the stage back too.
interface TimelineValue {
  stage: number;
  reportTime: (seconds: number) => void;
}

const BtdTimelineContext = createContext<TimelineValue | null>(null);

export function BtdTimelineProvider({
  cues,
  children,
}: {
  cues: number[];
  children: React.ReactNode;
}) {
  const [stage, setStage] = useState(0);

  // timeupdate fires ~4×/s; setStage bails out when the stage is unchanged,
  // so this only re-renders on an actual cue crossing.
  const reportTime = useCallback(
    (seconds: number) => setStage(cues.filter((cue) => seconds >= cue).length),
    [cues],
  );

  return (
    <BtdTimelineContext.Provider value={{ stage, reportTime }}>
      {children}
    </BtdTimelineContext.Provider>
  );
}

// For the video: a no-op outside a provider (e.g. the mobile card deck).
export function useReportBtdTime() {
  return useContext(BtdTimelineContext)?.reportTime;
}

// Stacks one image per stage and crossfades to the current one. All of them
// stay mounted so the swap is instant — no load gap mid-video.
export function TimelineImage({
  srcs,
  alt,
  className = "",
  sizes,
}: {
  srcs: string[];
  alt: string;
  className?: string;
  sizes: string;
}) {
  const stage = useContext(BtdTimelineContext)?.stage ?? 0;
  const shown = Math.min(stage, srcs.length - 1);

  return (
    <>
      {srcs.map((src, i) => (
        <Image
          key={src}
          fill
          alt={i === shown ? alt : ""}
          aria-hidden={i !== shown}
          className={`${className} transition-[opacity,transform] duration-700 ease-in-out ${i === shown ? "opacity-100" : "opacity-0"}`}
          sizes={sizes}
          src={src}
        />
      ))}
    </>
  );
}

// Brand maroon — the same accent as the panel border and links.
const SPARK_COLOR = "#621600";
const SPARK_COUNT = 18;

// A burst of maroon spark streaks that pops outward from the edges of the
// box it's placed in, every time the timeline stage changes (i.e. whenever
// the synced photo swaps). Nothing fires on first render, and it's skipped
// entirely for visitors who prefer reduced motion.
export function TimelineSparks() {
  const stage = useContext(BtdTimelineContext)?.stage ?? 0;
  const hostRef = useRef<HTMLDivElement>(null);
  const lastStage = useRef(stage);

  useEffect(() => {
    if (stage === lastStage.current) return;
    lastStage.current = stage;

    const host = hostRef.current;

    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { width, height } = host.getBoundingClientRect();

    for (let i = 0; i < SPARK_COUNT; i++) {
      // Start on a random point of the top, right or left edge (not the
      // bottom — those streaks crossed the product name below the photo)
      // and fly out along that edge's outward normal with some spread.
      const edge = [0, 1, 3][Math.floor(Math.random() * 3)];
      const along = Math.random();
      const [x, y, baseAngle] =
        edge === 0
          ? [along * width, 0, -90]
          : edge === 1
            ? [width, along * height, 0]
            : edge === 2
              ? [along * width, height, 90]
              : [0, along * height, 180];
      const angle = ((baseAngle + (Math.random() - 0.5) * 70) * Math.PI) / 180;
      const distance = 28 + Math.random() * 48;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const length = 8 + Math.random() * 10;

      const spark = document.createElement("span");

      // A thin streak pointing along its direction of travel; square ends to
      // match the no-rounding panel.
      Object.assign(spark.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${length}px`,
        height: "2px",
        marginTop: "-1px",
        background: SPARK_COLOR,
        transformOrigin: "0 50%",
        pointerEvents: "none",
      });
      host.appendChild(spark);

      const rotate = `rotate(${(angle * 180) / Math.PI}deg)`;
      const animation = spark.animate(
        [
          { transform: `translate(0, 0) ${rotate} scaleX(0.4)`, opacity: 1 },
          {
            transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) ${rotate} scaleX(1)`,
            opacity: 1,
            offset: 0.45,
          },
          { transform: `translate(${dx}px, ${dy}px) ${rotate} scaleX(0.2)`, opacity: 0 },
        ],
        {
          duration: 550 + Math.random() * 300,
          delay: Math.random() * 90,
          easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
          fill: "both",
        },
      );

      animation.onfinish = () => spark.remove();
    }
  }, [stage]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
    />
  );
}
