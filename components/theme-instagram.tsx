"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { InstagramIcon } from "@/components/icons";
import { IconSvgProps } from "@/types";

export default function ThemeInstagram({ size = 24, ...props }: IconSvgProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // During SSR and initial client render, assume light theme to prevent flash
    return (
      <span>
        <InstagramIcon size={size} {...props} />
      </span>
    );
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDarkMode = currentTheme === "dark";

  // Custom styles for the icon based on theme
  const svgStyle = {
    color: isDarkMode ? "white" : "black",
  };

  return (
    <span style={svgStyle}>
      <InstagramIcon size={size} {...props} />
    </span>
  );
}
