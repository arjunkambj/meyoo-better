"use client";

export default function MessageSkeleton({ rows = 3 }: { rows?: number }) {
  const items = Array.from({ length: Math.max(rows, 1) });
  return (
    <div className="space-y-2 py-1">
      {items.map((_, i) => {
        const isAssistant = i % 2 === 0;
        const width = isAssistant ? 0.65 : 0.6; // relative width
        return (
          <div
            key={i}
            className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
          >
            <div
              className="rounded-2xl bg-content2 animate-pulse"
              style={{ width: `${width * 100}%`, height: 36 }}
            />
          </div>
        );
      })}
    </div>
  );
}

