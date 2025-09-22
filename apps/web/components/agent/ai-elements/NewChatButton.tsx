"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/libs/utils";

interface NewChatButtonProps {
  onClick: () => void;
  className?: string;
}

export default function NewChatButton({ onClick, className }: NewChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "text-sm font-medium",
        "rounded-lg border border-default-200",
        "text-default-700 bg-background",
        "hover:bg-default-50 transition-colors",
        className
      )}
    >
      <Icon icon="solar:add-circle-linear" width={18} />
      <span>New Chat</span>
    </button>
  );
}