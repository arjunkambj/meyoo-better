"use client";

export default function TypingMessage({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-start py-1.5">
      <div className="max-w-[85%]">
        <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-sm bg-default-100 text-foreground text-sm px-4 py-3">
          <span className="text-default-700 font-medium">{label}</span>
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-duration:1.4s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-duration:1.4s] [animation-delay:200ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-duration:1.4s] [animation-delay:400ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

