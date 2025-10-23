"use client";

import { ComponentPropsWithoutRef, useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

import { cn } from "@/libs/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(startValue);
  const springValue = useSpring(motionValue, {
    damping: 24,
    stiffness: 320,
  });
  const previousValue = useRef(startValue);
  const hasAnimated = useRef(false);
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;

    const fromValue = hasAnimated.current
      ? previousValue.current
      : direction === "down"
        ? Math.max(startValue, value)
        : Math.min(startValue, value);

    motionValue.set(fromValue);

    const timer = window.setTimeout(() => {
      motionValue.set(value);
      previousValue.current = value;
      hasAnimated.current = true;
    }, delay * 1000);

    return () => window.clearTimeout(timer);
  }, [value, direction, delay, motionValue, isInView, startValue]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (!ref.current) return;

        ref.current.textContent = Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(Number(latest.toFixed(decimalPlaces)));
      }),
    [springValue, decimalPlaces]
  );

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-black tabular-nums dark:text-white",
        className
      )}
      {...props}
    >
      {Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(startValue)}
    </span>
  );
}
