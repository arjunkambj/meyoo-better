"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/libs/utils";

interface MessageActionsProps {
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onShare?: () => void;
  isPinned?: boolean;
  className?: string;
}

export default function MessageActions({
  onCopy,
  onEdit,
  onDelete,
  onPin,
  onShare,
  isPinned = false,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        onClick={handleCopy}
        className={cn(
          "p-1 rounded text-default-400",
          "hover:text-default-600 hover:bg-default-50",
          "transition-all"
        )}
        title={copied ? "Copied!" : "Copy"}
      >
        <Icon
          icon={copied ? "solar:check-circle-bold" : "solar:copy-linear"}
          width={16}
          className={cn(copied && "text-success")}
        />
      </button>

      {onPin && (
        <button
          onClick={onPin}
          className={cn(
            "p-1 rounded text-default-400",
            "hover:text-default-600 hover:bg-default-50",
            "transition-all",
            isPinned && "text-warning"
          )}
          title={isPinned ? "Unpin" : "Pin"}
        >
          <Icon
            icon={isPinned ? "solar:pin-bold" : "solar:pin-linear"}
            width={16}
          />
        </button>
      )}

      {onShare && (
        <button
          onClick={onShare}
          className={cn(
            "p-1 rounded text-default-400",
            "hover:text-default-600 hover:bg-default-50",
            "transition-all"
          )}
          title="Share"
        >
          <Icon icon="solar:share-linear" width={16} />
        </button>
      )}

      {onEdit && (
        <button
          onClick={onEdit}
          className={cn(
            "p-1 rounded text-default-400",
            "hover:text-default-600 hover:bg-default-50",
            "transition-all"
          )}
          title="Edit"
        >
          <Icon icon="solar:pen-linear" width={16} />
        </button>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          className={cn(
            "p-1 rounded text-default-400",
            "hover:text-destructive hover:bg-destructive/10",
            "transition-all"
          )}
          title="Delete"
        >
          <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
        </button>
      )}
    </div>
  );
}