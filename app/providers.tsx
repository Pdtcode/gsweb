"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  // Lock a stable viewport height for the full-screen fixed background layers so
  // they don't "breathe"/rescale as Chrome's mobile toolbar animates in/out on
  // scroll (the downside of dvh). We seed from the LARGE (toolbar-hidden) height
  // — measured up front from the CSS `lvh` unit so it's known on the very first
  // paint, before any scroll retracts the toolbar — then keep the TALLEST value
  // seen (never shrink). This makes the bg-cover art scale to its final height
  // immediately instead of loading short and rescaling on scroll. Exposed as
  // --app-height (bg layers use height: var(--app-height)); re-lock on
  // orientation change. The CSS default (100lvh in globals.css) covers the
  // moment before this runs.
  React.useEffect(() => {
    const root = document.documentElement;

    // Resolve `100lvh` to pixels via a hidden probe — the toolbar-retracted
    // viewport height, available even while the toolbar is currently showing.
    const measureLvh = () => {
      const probe = document.createElement("div");

      probe.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;

      document.body.removeChild(probe);

      // Fall back to innerHeight if lvh is unsupported (probe reports 0).
      return h || window.innerHeight;
    };

    let maxH = 0;

    const grow = () => {
      const h = Math.max(window.innerHeight, measureLvh());

      if (h > maxH) {
        maxH = h;
        root.style.setProperty("--app-height", `${maxH}px`);
      }
    };
    const reset = () => {
      maxH = Math.max(window.innerHeight, measureLvh());
      root.style.setProperty("--app-height", `${maxH}px`);
    };

    grow();
    window.addEventListener("resize", grow);
    window.addEventListener("orientationchange", reset);

    return () => {
      window.removeEventListener("resize", grow);
      window.removeEventListener("orientationchange", reset);
    };
  }, []);

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
