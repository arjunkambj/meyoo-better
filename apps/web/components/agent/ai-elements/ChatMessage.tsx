"use client";

import { useState } from "react";
import { cn } from "@/libs/utils";
import { Icon } from "@iconify/react";
import MessageActions from "./MessageActions";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  onCopy,
  onEdit,
  onDelete,
  onRegenerate,
  className,
}: ChatMessageProps) {
  const [showActions, setShowActions] = useState(false);
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    onCopy?.();
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-3",
        isUser && "bg-default-50",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-default-200 text-default-600"
        )}
      >
        <Icon
          icon={isUser ? "solar:user-bold" : "solar:magic-stick-3-bold"}
          width={16}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-medium text-default-700">
            {isUser ? "You" : "Assistant"}
          </span>
          {timestamp && (
            <span className="text-xs text-default-400">
              {timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="text-sm text-default-900 whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
      {showActions && (
        <div className="absolute right-4 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageActions
            onCopy={handleCopy}
            onEdit={isUser ? onEdit : undefined}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
}