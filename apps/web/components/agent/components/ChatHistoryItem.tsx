"use client";

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";

export type ChatHistoryItemProps = {
  id: string;
  title: string;
  active?: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function ChatHistoryItem({
  id,
  title,
  active = false,
  onSelect,
  onRename,
  onDelete,
}: ChatHistoryItemProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={active ? "flat" : "light"}
        color="default"
        className={`flex-1 justify-start ${active ? "bg-default-200" : ""}`}
        onPress={() => onSelect(id)}
      >
        <div className="truncate w-full text-left text-sm">{title}</div>
      </Button>
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button isIconOnly size="sm" variant="light" aria-label="More actions">
            <Icon icon="solar:menu-dots-bold" width={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Chat actions">
          <DropdownItem key="rename" startContent={<Icon icon="solar:pen-bold" width={14} />} onPress={() => onRename(id)}>
            Rename
          </DropdownItem>
          <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Icon icon="solar:trash-bin-minimalistic-bold" width={14} />} onPress={() => onDelete(id)}>
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
