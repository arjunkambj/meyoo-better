"use client";

import { Input } from "@heroui/react";
import type { InputProps } from "@heroui/react";
import React from "react";
import { sanitizeDecimal } from "./sanitize";

type NumericInputProps = Omit<InputProps, "onValueChange" | "type" | "inputMode"> & {
  onValueChange?: (value: string) => void;
};

export function NumericInput({ onValueChange, ...rest }: NumericInputProps) {
  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      onValueChange={(val) => onValueChange?.(sanitizeDecimal(val))}
    />
  );
}

export { sanitizeDecimal };
