"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { NEW_ARRIVALS_HOME_ACTIVE } from "@/config/homepage";

export default function ThemeLogo() {
  const { theme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<number>(1);

  // Logo variants available (1-5)
  const logoVariants = [1, 2, 3, 4, 5];

  // Randomly select a logo variant on mount and pathname change
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * logoVariants.length);
    setSelectedLogo(logoVariants[randomIndex]);
    if (!mounted) {
      setMounted(true);
    }
  }, [pathname, mounted]);

  if (!mounted) {
    // During SSR and initial client render, show a placeholder
    return (
      <div className="relative w-12 h-12 mr-1">
        <div className="w-full h-full" />
      </div>
    );
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDarkMode = currentTheme === "dark";

  // The homepage navbar is maroon (when the new-arrivals homepage is active),
  // so force the white logo there regardless of theme to keep it legible.
  const isMaroonHome = pathname === "/" && NEW_ARRIVALS_HOME_ACTIVE;
  const useLightLogo = isDarkMode || isMaroonHome;

  // Construct the logo path based on theme and selected variant
  const logoColor = useLightLogo ? "White" : "Black";
  const logoNumber =
    selectedLogo === 5 && useLightLogo ? "06" : `0${selectedLogo}`;
  const logoPath = `/01 Logo Exports/Logo ${selectedLogo}/${useLightLogo ? "02 white" : "01 black"}/GS-${logoNumber}-${logoColor}.svg`;

  return (
    <div className="relative w-12 h-12 mr-1">
      <Image
        alt="Grail Seekers Logo"
        className="w-full h-full object-contain transition-all duration-300"
        layout="fill"
        src={logoPath}
      />
    </div>
  );
}
