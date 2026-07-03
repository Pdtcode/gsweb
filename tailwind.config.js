import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        udmincho: ["var(--font-udmincho)", "serif"],
      },
      animation: {
        fadeIn: 'fadeIn 1s ease-in-out',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        // Pulsing neon bloom — animates opacity only, so the cached blur/blend
        // buffer isn't re-rasterized each frame (compositor-friendly).
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        // Dark-mode intro: the eye tear "slashes" open (diagonal wipe) to reveal
        // the neon Kabuki underneath, THEN a bright blade glint sweeps across the
        // already-open eye, BEFORE the rest of the torn cloth fades in. Runs once
        // on the → dark transition. `both` fill-mode holds the closed state before
        // and the open state after. See components/new-arrivals-home.tsx.
        // Staggered starts: the eye unzips first (0.5s delay, after the blackout
        // lands), then the glint fires once the eye is open (1.0s delay).
        // eye-reveal uses a steady near-linear ease so the zipper slider visibly
        // travels along the midline the whole way (a front-loaded ease makes it
        // snap open and read as a plain wipe).
        'eye-reveal': 'eyeReveal 0.3s cubic-bezier(0.42, 0, 0.58, 1) 0.5s both',
        'eye-glint': 'eyeGlint 0.2s cubic-bezier(0.5, 0, 0.2, 1) 1s both',
        // After the eye, the SURROUNDING tears repeat the same unzip + glint
        // (masked to ripped-tears.svg = all non-eye tears), then the cloth fades
        // in. tears-glint reuses the eyeGlint keyframes (a full-screen diagonal
        // band) with a later start; tears-reveal is a full-viewport chevron sweep.
        'tears-reveal': 'tearsReveal 0.4s cubic-bezier(0.42, 0, 0.58, 1) 1s both',
        'tears-glint': 'eyeGlint 0.5s cubic-bezier(0.5, 0, 0.2, 1) 1.5s both',
        // Subtle scroll hint — a gentle down-bob + opacity pulse on the chevron
        // above the "Also New" products, nudging the user to scroll.
        'scroll-hint': 'scrollHint 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        // The eye UNZIPS along its midpoint line: a right-pointing arrow/chevron
        // clip-path whose apex (the "zipper slider") travels left→right along the
        // eye's ~46% on-screen midline. Behind the slider the tear is fully gaped
        // open (the rectangle back to the left edge); ahead of it it's still shut;
        // the V-point is where the two halves are separating. Intersected with the
        // eye-shape mask, so it reads as the slash unzipping. The 30%/62% band
        // brackets the eye's on-screen vertical extent under mask-size:cover; the
        // apex x sweeps past both eye tips (~32%→82%) so it fully opens.
        eyeReveal: {
          '0%': { opacity: '0', clipPath: 'polygon(0% 30%, 22% 30%, 32% 46%, 22% 62%, 0% 62%)' },
          '8%': { opacity: '1' },
          '100%': { opacity: '1', clipPath: 'polygon(0% 30%, 72% 30%, 82% 46%, 72% 62%, 0% 62%)' },
        },
        // The blade glint: a thin diagonal band sweeping left→right across and
        // off-screen. Fires after the eye is open, so it reads as a blade glinting
        // across the revealed tear. Masked to the eye, so it only flashes within it.
        eyeGlint: {
          '0%': { opacity: '0', clipPath: 'polygon(-22% 0, -10% 0, -50% 100%, -62% 100%)' },
          '15%': { opacity: '1' },
          '85%': { opacity: '0.9' },
          '100%': { opacity: '0', clipPath: 'polygon(158% 0, 170% 0, 130% 100%, 118% 100%)' },
        },
        // Full-viewport version of the eye's unzip chevron: the apex sweeps along
        // the screen midline (50%) across the whole width with a full-height band,
        // so every scattered surrounding tear opens left→right behind the slider.
        // Masked to ripped-tears.svg, so only the tears actually reveal.
        tearsReveal: {
          '0%': { opacity: '0', clipPath: 'polygon(0% 0%, -22% 0%, -10% 50%, -22% 100%, 0% 100%)' },
          '8%': { opacity: '1' },
          '100%': { opacity: '1', clipPath: 'polygon(0% 0%, 103% 0%, 115% 50%, 103% 100%, 0% 100%)' },
        },
        scrollHint: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '50%': { transform: 'translateY(6px)', opacity: '0.85' },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
}

module.exports = config;