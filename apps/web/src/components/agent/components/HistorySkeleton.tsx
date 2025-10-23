"use client";

export default function HistorySkeleton({ rows = 8 }: { rows?: number }) {
  const items = Array.from({ length: Math.max(rows, 1) });
  return (
    <div className="space-y-2 pt-2">
      {items.map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 h-11 w-full rounded-lg bg-gradient-to-r from-default-100 to-default-50 animate-pulse px-3"
        >
          <div className="w-4 h-4 rounded-full bg-default-200/50 animate-pulse" />
          <div className={`h-2 bg-default-200/50 rounded animate-pulse`} style={{ width: `${60 + Math.random() * 30}%` }} />
        </div>
      ))}
    </div>
  );
}

