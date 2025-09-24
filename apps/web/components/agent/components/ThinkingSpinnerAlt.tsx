"use client";

import { Icon } from "@iconify/react";

export default function ThinkingSpinnerAlt({ label }: { label?: string }) {
  return (
    <div className="flex items-start py-1">
      <div className="inline-flex items-center gap-2 rounded-2xl bg-content2 text-foreground text-sm px-3 py-2">
        <Icon icon="solar:radar-2-bold" width={16} className="animate-spin-slow text-default-600" />
        <span className="text-default-700">{label ?? "Thinking…"}</span>
      </div>
    </div>
  );
}

