"use client";

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
  const { theme } = useTheme();
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
