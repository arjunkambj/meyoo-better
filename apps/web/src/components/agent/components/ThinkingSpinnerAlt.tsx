"use client";

import { Icon } from "@iconify/react";

export default function ThinkingSpinnerAlt({ label }: { label?: string }) {
  return (
    <div className="flex items-start py-1.5">
      <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-gradient-to-r from-primary/5 to-primary/10 backdrop-blur-sm ring-1 ring-primary/20 text-sm px-4 py-3">
        <Icon
          icon="solar:magic-stick-3-bold-duotone"
          width={18}
          className="animate-pulse text-primary"
        />
        <span className="text-default-700 font-medium">{label ?? "Thinking…"}</span>
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

