"use client";

export default function TypingMessage({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-start py-2">
      <div className="max-w-[90%]">
        <div className="inline-flex items-center gap-2.5 rounded-lg rounded-tl-sm bg-content2 text-foreground text-sm px-3.5 py-2.5">
          <span className="text-default-600 font-medium">{label}</span>
          <span className="inline-flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-duration:1.4s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-duration:1.4s] [animation-delay:200ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-duration:1.4s] [animation-delay:400ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

