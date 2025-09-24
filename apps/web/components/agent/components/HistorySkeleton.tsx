"use client";

export default function HistorySkeleton({ rows = 8 }: { rows?: number }) {
  const items = Array.from({ length: Math.max(rows, 1) });
  return (
    <div className="space-y-2 pt-1 pr-1">
      {items.map((_, i) => (
        <div key={i} className="h-9 w-full rounded-medium bg-content2 animate-pulse" />
      ))}
    </div>
  );
}

