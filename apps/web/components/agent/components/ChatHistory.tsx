"use client";

import {Button} from "@heroui/react";
import {Icon} from "@iconify/react";

export type ChatItem = {
  id: string;
  title: string;
  lastAt?: string;
};

export default function ChatHistory({
  items,
  activeId,
  onSelect,
}: {
  items: ChatItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="text-xs text-default-500 px-1">Recent</div>
      <div className="max-h-28 overflow-y-auto pr-1">
        {items.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={c.id === activeId ? "solid" : "light"}
            color={c.id === activeId ? "primary" : "default"}
            className="w-full justify-start h-8"
            startContent={<Icon icon="solar:clock-circle-bold" width={14} />}
            onPress={() => onSelect(c.id)}
          >
            <span className="truncate text-sm">{c.title}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

