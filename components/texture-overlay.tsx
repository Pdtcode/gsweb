"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface TextureOverlayProps {
  textureUrl: string;
  opacity?: number;
  className?: string;
  blendMode?: string;
}

export default function TextureOverlay({
  textureUrl,
  opacity = 0.2,
  blendMode = "overlay",
  className = "",
}: TextureOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by rendering consistent content on server and initial client render
  if (!mounted) {
    return (
      <div
        className={`fixed inset-0 w-screen h-full pointer-events-none ${className}`}
        style={{
          backgroundImage: `url('${textureUrl}')`,
          backgroundRepeat: "repeat",
          backgroundSize: "1000px 1000px",
          opacity: opacity,
          mixBlendMode: blendMode as any,
          filter: "none",
        }}
      />
    );
  }

  return (
    <>
      {/* Main texture layer */}
      <div
        className={`fixed inset-0 w-screen h-full pointer-events-none ${className}`}
        style={{
          backgroundImage: `url('${textureUrl}')`,
          backgroundRepeat: "repeat",
          backgroundSize: "1000px 1000px", // Large fixed size to ensure coverage
          opacity: opacity,
          mixBlendMode: theme === "dark" ? "screen" : (blendMode as any),
          filter: theme === "dark" ? "invert(1)" : "none",
        }}
      />
    </>
  );
}
