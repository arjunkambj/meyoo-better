"use client";

import { cn } from "@/libs/utils";
import { Icon } from "@iconify/react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
}

interface ChatHistoryProps {
  chats: Chat[];
  activeId?: string;
  onSelectChat: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  className?: string;
}

export default function ChatHistory({
  chats,
  activeId,
  onSelectChat,
  onDeleteChat,
  className,
}: ChatHistoryProps) {
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-4 py-2 text-xs font-medium text-default-500 uppercase">
        Recent Chats
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-1">
          {chats.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-default-400">
              No chat history yet
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer",
                  "hover:bg-default-50 transition-colors",
                  activeId === chat.id && "bg-default-100"
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <Icon
                  icon="solar:chat-round-dots-linear"
                  width={16}
                  className="flex-shrink-0 mt-0.5 text-default-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-default-700 truncate">
                      {chat.title}
                    </p>
                    <span className="text-xs text-default-400 flex-shrink-0">
                      {formatRelativeTime(chat.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-default-500 truncate mt-0.5">
                    {chat.lastMessage}
                  </p>
                </div>
                {onDeleteChat && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className={cn(
                      "opacity-0 group-hover:opacity-100",
                      "p-1 rounded hover:bg-default-100",
                      "text-default-400 hover:text-default-600",
                      "transition-all"
                    )}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-linear" width={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}