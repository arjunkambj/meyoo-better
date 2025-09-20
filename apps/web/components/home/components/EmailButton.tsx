"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import type React from "react";

interface EmailButtonProps {
  email: string;
  subject?: string;
  body?: string;
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
  startIcon?: string;
  className?: string;
}

export default function EmailButton({
  email,
  subject = "",
  body = "",
  children,
  size = "lg",
  color = "primary",
  variant = "solid",
  startIcon = "solar:letter-bold-duotone",
  className = "",
}: EmailButtonProps) {
  const mailtoLink = `mailto:${email}${subject || body ? "?" : ""}${
    subject ? `subject=${encodeURIComponent(subject)}` : ""
  }${subject && body ? "&" : ""}${body ? `body=${encodeURIComponent(body)}` : ""}`;

  return (
    <Button
      as={Link}
      className={className}
      color={color}
      href={mailtoLink}
      size={size}
      startContent={<Icon icon={startIcon} />}
      variant={variant}
    >
      {children}
    </Button>
  );
}
