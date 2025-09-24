"use client";

export default function TypingMessage({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-start py-1">
      <div className="max-w-[90%]">
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-content2 text-foreground text-sm px-3 py-2">
          <span className="text-default-600">{label}</span>
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-default-500 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-default-500 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-default-500 animate-pulse [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

