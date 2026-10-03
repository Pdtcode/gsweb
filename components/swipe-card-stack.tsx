"use client";

import { Children, createContext, useRef, useState } from "react";

// True for the card currently at the front of the deck. Cards outside any
// stack (e.g. the desktop layout) get the default, true. The video reads this
// to pause itself when it's swiped to the back.
export const CardActiveContext = createContext(true);

interface SwipeCardStackProps {
  children: React.ReactNode;
  // One short label per card, for the dots and the swipe hint.
  labels: string[];
  className?: string;
}

// How far (px) a drag has to travel before it counts as a swipe rather than
// a tap, and before release commits to the next/previous card.
const TAP_SLOP = 8;
const SWIPE_COMMIT = 60;

// A deck of cards stacked on top of each other: the front card is fully
// shown, the next one peeks out behind it, offset and tilted. Swipe the front
// card sideways (or tap a dot) to bring the next one forward. Vertical page
// scrolling is left alone — only horizontal drags are claimed.
export default function SwipeCardStack({
  children,
  labels,
  className = "",
}: SwipeCardStackProps) {
  const cards = Children.toArray(children);
  const [active, setActive] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);

  const goTo = (index: number) => {
    const next = (index + cards.length) % cards.length;

    setActive(next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Controls inside a card (the video's scrub bar etc.) own their drags.
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;

    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;

    if (!dragging) {
      // Mostly vertical: it's a page scroll, let it go.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > TAP_SLOP) {
        start.current = null;

        return;
      }
      if (Math.abs(dx) < TAP_SLOP) return;
      setDragging(true);
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragX(dx);
  };

  const endDrag = () => {
    if (dragging) {
      if (dragX <= -SWIPE_COMMIT) goTo(active + 1);
      else if (dragX >= SWIPE_COMMIT) goTo(active - 1);
    }
    start.current = null;
    setDragging(false);
    setDragX(0);
  };

  return (
    <div className={className}>
      <div
        className="relative aspect-[9/16] w-full touch-pan-y select-none"
        // A drag that ended over a link or button must not also click it —
        // otherwise swiping the product card would open the product page.
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
        // Mouse-dragging a link or image starts the browser's native
        // drag-and-drop, which cancels the pointer stream mid-swipe.
        onDragStart={(e) => e.preventDefault()}
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        {cards.map((card, i) => {
          // Position in the deck relative to the front card: 0 = front,
          // 1 = directly behind, and so on.
          const depth = (i - active + cards.length) % cards.length;
          const isFront = depth === 0;
          // Tight two-layer shadows (contact + soft drop) cast down-right, the
          // same way the back card peeks out — one wide blur on every card
          // haloed past the edges and doubled up on the card behind. The
          // front card lifts further while it's being dragged.
          const boxShadow = !isFront
            ? "0 1px 2px rgba(0,0,0,0.12)"
            : dragging
              ? "0 2px 4px rgba(0,0,0,0.12), 0 18px 32px -12px rgba(0,0,0,0.35)"
              : "0 1px 2px rgba(0,0,0,0.12), 0 10px 20px -10px rgba(0,0,0,0.3)";
          const transform = isFront
            ? `translateX(${dragX}px) rotate(${dragX / 25}deg)`
            : `translateX(${depth * 10}px) translateY(${depth * 8}px) rotate(${depth * 2}deg) scale(${1 - depth * 0.03})`;

          return (
            <div
              key={i}
              aria-hidden={!isFront}
              className={`absolute inset-0 overflow-hidden ${
                dragging && isFront ? "" : "transition-[transform,box-shadow] duration-300 ease-out"
              } ${isFront ? "" : "pointer-events-none"}`}
              // inert keeps keyboard focus off the cards that are behind.
              inert={!isFront}
              style={{ transform, zIndex: cards.length - depth, boxShadow }}
            >
              <CardActiveContext.Provider value={isFront}>
                {card}
              </CardActiveContext.Provider>
            </div>
          );
        })}
      </div>

      {/* Square dots + a hint naming what's behind the current card. Dots
          are real buttons, so the deck works without swiping too. They sit
          on the page background, so they follow the theme foreground. */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          {cards.map((_, i) => (
            <button
              key={i}
              aria-current={i === active}
              aria-label={`Show ${labels[i] ?? `card ${i + 1}`}`}
              className={`h-2 w-6 transition-colors ${i === active ? "bg-foreground" : "bg-foreground/25"}`}
              type="button"
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          className="text-xs font-semibold uppercase tracking-[0.25em] text-foreground/70"
          type="button"
          onClick={() => goTo(active + 1)}
        >
          Swipe for {labels[(active + 1) % cards.length]}&nbsp;→
        </button>
      </div>
    </div>
  );
}
