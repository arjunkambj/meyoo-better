"use client";

import { Input } from "@heroui/input";
import type { InputProps } from "@heroui/input";
import React from "react";

import { cn } from "@/libs/utils";

import {
  DATA_TABLE_INPUT_CLASS,
  DATA_TABLE_INPUT_WRAPPER_CLASS,
} from "./DataTableCard";
import { sanitizeDecimal } from "./sanitize";

type NumericInputProps = Omit<InputProps, "onValueChange" | "type" | "inputMode"> & {
  onValueChange?: (value: string) => void;
};

export function NumericInput({ onValueChange, classNames, ...rest }: NumericInputProps) {
  const mergedClassNames = {
    ...classNames,
    inputWrapper: cn(DATA_TABLE_INPUT_WRAPPER_CLASS, classNames?.inputWrapper),
    input: cn(DATA_TABLE_INPUT_CLASS, classNames?.input),
  };

  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      classNames={mergedClassNames}
      onValueChange={(val) => onValueChange?.(sanitizeDecimal(val))}
    />
  );
}

export { sanitizeDecimal };
