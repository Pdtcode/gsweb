"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { useReportBtdTime } from "@/components/btd-timeline";
import { CardActiveContext } from "@/components/swipe-card-stack";

interface BtdVideoProps {
  src: string;
  poster: string;
  label: string;
  className?: string;
}

// How long the control bar lingers after the last pointer/keyboard activity
// while playing before it fades out of the way.
const CONTROLS_HIDE_MS = 2500;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Click-to-play video with fully custom, on-brand controls — the browser's
// native player chrome is never shown (no `controls` attribute). It's an
// interview, so it plays with sound; muted autoplay would lose the point.
export default function BtdVideo({
  src,
  poster,
  label,
  className = "",
}: BtdVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointerType = useRef<string>("mouse");

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  // Show the bar, then schedule it to hide again — but only while playing;
  // a paused video keeps its controls up.
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, CONTROLS_HIDE_MS);
  }, []);

  // Drives the synced product photos on desktop; undefined elsewhere.
  const reportTime = useReportBtdTime();

  // Swiped to the back of a card stack: stop talking.
  const isFrontCard = useContext(CardActiveContext);

  useEffect(() => {
    if (!isFrontCard) videoRef.current?.pause();
  }, [isFrontCard]);

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);

    document.addEventListener("fullscreenchange", onChange);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const handleStart = () => {
    setStarted(true);
    void videoRef.current?.play();
    pokeControls();
  };

  const togglePlay = () => {
    const v = videoRef.current;

    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
    pokeControls();
  };

  const toggleMute = () => {
    const v = videoRef.current;

    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    pokeControls();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    const v = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;

    if (!el || !v) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen) {
      // Fullscreen the wrapper, not the <video>, so our controls come along.
      void el.requestFullscreen();
    } else {
      // iOS Safari has no element fullscreen — only the native video one,
      // which brings the system player. Best available there.
      v.webkitEnterFullscreen?.();
    }
    pokeControls();
  };

  // Map a pointer x-position on the progress track to a time and seek there.
  const seekToClientX = (clientX: number) => {
    const track = trackRef.current;
    const v = videoRef.current;

    if (!track || !v || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);

    v.currentTime = ratio * duration;
    setCurrent(v.currentTime);
  };

  const handleTrackKey = (e: React.KeyboardEvent) => {
    const v = videoRef.current;

    if (!v) return;
    if (e.key === "ArrowRight") v.currentTime = Math.min(v.currentTime + 5, duration);
    else if (e.key === "ArrowLeft") v.currentTime = Math.max(v.currentTime - 5, 0);
    else return;
    e.preventDefault();
    pokeControls();
  };

  const progress = duration ? (current / duration) * 100 : 0;
  const showBar = started && (controlsVisible || !playing || scrubbing);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black ${className}`}
      onPointerMove={started ? pokeControls : undefined}
    >
      {/* No captions file yet — add a <track> (btd.vtt) when one exists. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        playsInline
        aria-label={label}
        // The slot is sized to the clip's 9:16, so cover neither crops nor
        // letterboxes. Fullscreen is usually a landscape screen, so contain
        // there to keep the whole frame.
        className={`absolute inset-0 h-full w-full ${fullscreen ? "object-contain" : "object-cover"}`}
        poster={poster}
        // preload="none" keeps the file off the initial page load until
        // someone actually presses play.
        preload="none"
        src={src}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        // Back to the poster + start button when it finishes.
        onEnded={() => {
          setStarted(false);
          setPlaying(false);
          setCurrent(0);
          reportTime?.(0);
          videoRef.current?.load();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(e) => {
          // Seeks fire timeupdate too, so scrubbing keeps the synced
          // photos in step even while the progress UI is held.
          reportTime?.(e.currentTarget.currentTime);
          if (!scrubbing) setCurrent(e.currentTarget.currentTime);
        }}
      />

      {!started ? (
        <button
          aria-label={`Play: ${label}`}
          className="group absolute inset-0 flex items-end justify-start p-5 focus-visible:outline-none sm:p-8"
          type="button"
          onClick={handleStart}
        >
          {/* Square maroon plate + cream glyph, uppercase tracked label. */}
          <span className="flex items-center gap-4 border-2 border-[#f3ede1] bg-[#621600] py-3 pl-4 pr-6 text-[#f3ede1] transition-colors duration-300 group-hover:bg-[#f3ede1] group-hover:text-[#621600] group-focus-visible:ring-2 group-focus-visible:ring-[#f3ede1] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#621600]">
            <PlayIcon className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span className="text-sm font-semibold uppercase tracking-[0.25em]">
              Play
            </span>
          </span>
        </button>
      ) : (
        <>
          {/* Whole-frame tap target, under the control bar so the bar's
              buttons win. Mouse: click toggles play/pause. Touch: while the
              bar is hidden, the first tap only brings it back — otherwise a
              phone user reaching for the controls would pause instead. */}
          <button
            aria-label={playing ? "Pause" : "Play"}
            className="absolute inset-0 focus-visible:outline-none"
            type="button"
            onClick={() => {
              if (lastPointerType.current === "touch" && !showBar) {
                pokeControls();

                return;
              }
              togglePlay();
            }}
            onPointerDown={(e) => {
              lastPointerType.current = e.pointerType;
            }}
          />

          {/* Control bar — maroon strip pinned to the bottom edge, square
              corners, cream glyphs. Fades out while playing; any pointer
              movement or keyboard focus brings it back. */}
          <div
            data-no-swipe
            className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${showBar ? "opacity-100" : "pointer-events-none opacity-0"}`}
            onFocusCapture={pokeControls}
          >
            {/* Progress track — full width, sits on top of the bar. Tall hit
                area, thin visual line that thickens on hover. */}
            <div
              ref={trackRef}
              aria-label="Seek"
              aria-valuemax={Math.round(duration)}
              aria-valuemin={0}
              aria-valuenow={Math.round(current)}
              aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
              className="group/track relative flex h-4 cursor-pointer touch-none items-end focus-visible:outline-none"
              role="slider"
              tabIndex={0}
              onKeyDown={handleTrackKey}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setScrubbing(true);
                seekToClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (scrubbing) seekToClientX(e.clientX);
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                setScrubbing(false);
              }}
            >
              <div className="relative h-1 w-full bg-[#f3ede1]/30 transition-[height] group-hover/track:h-1.5 group-focus-visible/track:h-1.5">
                <div
                  className="absolute inset-y-0 left-0 bg-[#f3ede1]"
                  style={{ width: `${progress}%` }}
                />
                {/* Square playhead */}
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2 border-[#621600] bg-[#f3ede1] opacity-0 transition-opacity group-hover/track:opacity-100 group-focus-visible/track:opacity-100"
                  style={{ left: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#621600] px-2 py-1.5 text-[#f3ede1]">
              <ControlButton
                label={playing ? "Pause" : "Play"}
                onClick={togglePlay}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </ControlButton>

              <span className="ml-1 text-xs font-semibold uppercase tabular-nums tracking-[0.15em]">
                {formatTime(current)}
                <span className="mx-1.5 opacity-50">/</span>
                {formatTime(duration)}
              </span>

              <div className="ml-auto flex items-center gap-1">
                <ControlButton
                  label={muted ? "Unmute" : "Mute"}
                  onClick={toggleMute}
                >
                  {muted ? <MutedIcon /> : <VolumeIcon />}
                </ControlButton>
                <ControlButton
                  label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
                </ControlButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-[#f3ede1] hover:text-[#621600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f3ede1]"
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// Square-cornered glyphs to match the no-rounding panel.
function PlayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4l14 8-14 8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="miter"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16 9l6 6M22 9l-6 6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function ShrinkIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />
    </svg>
  );
}
