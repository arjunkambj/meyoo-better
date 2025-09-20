"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
  spacing?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { full: { width: 100, height: 30 }, icon: { width: 30, height: 30 } },
  md: { full: { width: 120, height: 36 }, icon: { width: 36, height: 36 } },
  lg: { full: { width: 150, height: 45 }, icon: { width: 45, height: 45 } },
} as const;

const TEXT_SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

const SPACING = {
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-3",
} as const;

export default function Logo({
  variant = "full",
  size = "lg",
  spacing = "md",
  className = "",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { width, height } = SIZES[size][variant];

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use fallback during hydration
  const logoSrc =
    mounted && resolvedTheme === "dark" ? "/logo-white.svg" : "/logo-black.svg";

  return (
    <div className={`inline-flex items-center ${className}`}>
      {variant === "full" ? (
        <div className={`flex items-center ${SPACING[spacing]}`}>
          <Image
            alt="Meyoo"
            className="object-contain"
            height={height}
            src={logoSrc}
            width={height}
          />
          <span className={`font-bold text-foreground ${TEXT_SIZES[size]}`}>
            Meyoo
          </span>
        </div>
      ) : (
        <Image
          alt="Meyoo"
          className="object-contain"
          height={height}
          src={logoSrc}
          width={width}
        />
      )}
    </div>
  );
}
