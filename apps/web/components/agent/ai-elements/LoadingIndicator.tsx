"use client";

import { cn } from "@/libs/utils";

interface LoadingIndicatorProps {
  type?: "dots" | "typing" | "thinking";
  className?: string;
}

export default function LoadingIndicator({
  type = "dots",
  className,
}: LoadingIndicatorProps) {
  if (type === "dots") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="w-2 h-2 bg-default-400 rounded-full animate-pulse" />
        <div className="w-2 h-2 bg-default-400 rounded-full animate-pulse delay-75" />
        <div className="w-2 h-2 bg-default-400 rounded-full animate-pulse delay-150" />
      </div>
    );
  }

  if (type === "typing") {
    return (
      <div className={cn("flex items-center gap-2 text-default-500", className)}>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-xs">Assistant is typing</span>
      </div>
    );
  }

  if (type === "thinking") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative w-4 h-4">
          <div className="absolute inset-0 border-2 border-default-300 rounded-full animate-ping" />
          <div className="absolute inset-0 border-2 border-t-primary border-default-200 rounded-full animate-spin" />
        </div>
        <span className="text-xs text-default-500">Thinking...</span>
      </div>
    );
  }

  return null;
}