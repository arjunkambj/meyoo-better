"use client";

export default function MessageSkeleton({ rows = 3 }: { rows?: number }) {
  const items = Array.from({ length: Math.max(rows, 1) });
  return (
    <div className="space-y-3 py-2">
      {items.map((_, i) => {
        const isAssistant = i % 2 === 0;
        const width = isAssistant ? 0.65 : 0.55;
        return (
          <div
            key={i}
            className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`rounded-lg ${
                isAssistant ? "rounded-tl-sm" : "rounded-tr-sm"
              } bg-gradient-to-r ${
                isAssistant
                  ? "from-content2 to-content2/80"
                  : "from-primary/10 to-primary/5"
              } animate-pulse`}
              style={{ width: `${width * 100}%`, height: 40 }}
            >
              <div className="h-full flex items-center px-3 gap-2">
                <div className="w-16 h-2 bg-default-200/50 rounded animate-pulse" />
                <div className="w-24 h-2 bg-default-200/50 rounded animate-pulse [animation-delay:150ms]" />
                <div className="w-12 h-2 bg-default-200/50 rounded animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

