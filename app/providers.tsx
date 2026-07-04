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
  // scroll (the downside of dvh). We track the TALLEST innerHeight seen — it
  // grows once when the toolbar first hides, then never shrinks back — and expose
  // it as --app-height; the bg layers use height: var(--app-height). Re-lock from
  // scratch on orientation change. Before this runs, the layers fall back to
  // their inset-0 (viewport) height.
  React.useEffect(() => {
    const root = document.documentElement;
    let maxH = 0;

    const grow = () => {
      if (window.innerHeight > maxH) {
        maxH = window.innerHeight;
        root.style.setProperty("--app-height", `${maxH}px`);
      }
    };
    const reset = () => {
      maxH = window.innerHeight;
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
