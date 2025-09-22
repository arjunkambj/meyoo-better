"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/libs/utils";

interface MessageToolbarProps {
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  isAssistant?: boolean;
  className?: string;
}

export default function MessageToolbar({
  onCopy,
  onEdit,
  onDelete,
  onRegenerate,
  isAssistant = false,
  className,
}: MessageToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 rounded-md",
        "bg-background border border-default-100",
        className
      )}
    >
      <button
        onClick={onCopy}
        className={cn(
          "p-1.5 rounded text-default-500",
          "hover:text-default-700 hover:bg-default-50",
          "transition-colors"
        )}
        title="Copy"
      >
        <Icon icon="solar:copy-linear" width={14} />
      </button>

      {isAssistant && onRegenerate && (
        <button
          onClick={onRegenerate}
          className={cn(
            "p-1.5 rounded text-default-500",
            "hover:text-default-700 hover:bg-default-50",
            "transition-colors"
          )}
          title="Regenerate"
        >
          <Icon icon="solar:refresh-linear" width={14} />
        </button>
      )}

      {!isAssistant && onEdit && (
        <button
          onClick={onEdit}
          className={cn(
            "p-1.5 rounded text-default-500",
            "hover:text-default-700 hover:bg-default-50",
            "transition-colors"
          )}
          title="Edit"
        >
          <Icon icon="solar:pen-linear" width={14} />
        </button>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          className={cn(
            "p-1.5 rounded text-default-500",
            "hover:text-destructive hover:bg-destructive/10",
            "transition-colors"
          )}
          title="Delete"
        >
          <Icon icon="solar:trash-bin-minimalistic-linear" width={14} />
        </button>
      )}
    </div>
  );
}