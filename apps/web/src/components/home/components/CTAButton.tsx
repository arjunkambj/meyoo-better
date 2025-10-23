"use client";

import { Button } from "@heroui/button";
import { Icon } from "@iconify/react";
import Link from "next/link";
import type React from "react";

interface CTAButtonProps {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  color?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "default";
  variant?:
    | "solid"
    | "bordered"
    | "light"
    | "flat"
    | "faded"
    | "shadow"
    | "ghost";
  endIcon?: string;
  startIcon?: string;
  className?: string;
  radius?: "none" | "sm" | "md" | "lg" | "full";
}

export default function CTAButton({
  href,
  children,
  size = "lg",
  color = "primary",
  variant = "solid",
  endIcon,
  startIcon,
  className = "",
  radius = "full",
}: CTAButtonProps) {
  return (
    <Button
      as={Link}
      className={`font-semibold ${className}`}
      color={color}
      endContent={endIcon ? <Icon icon={endIcon} width={20} /> : undefined}
      href={href}
      radius={radius}
      size={size}
      startContent={
        startIcon ? <Icon icon={startIcon} width={20} /> : undefined
      }
      variant={variant}
    >
      {children}
    </Button>
  );
}
