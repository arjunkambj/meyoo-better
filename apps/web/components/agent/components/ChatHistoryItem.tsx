"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";

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
    <div className={`group flex items-center rounded-lg gap-1 transition-colors ${
      active
        ? "bg-default-300 dark:bg-default-400"
        : "bg-default-100 dark:bg-default-200 hover:bg-default-200 dark:hover:bg-default-300"
    }`}>
      <Link
        href={`#${id}`}
        className="flex-1 flex items-center justify-start px-2 py-1.5 text-sm"
        onClick={(e) => {
          e.preventDefault();
          onSelect(id);
        }}
      >
        <div className="truncate w-full text-left">{title}</div>
      </Link>
      <Dropdown placement="bottom-end">
        <DropdownTrigger className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="More actions"
          >
            <Icon icon="solar:menu-dots-bold" width={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Chat actions">
          <DropdownItem
            key="rename"
            startContent={<Icon icon="solar:pen-bold" width={14} />}
            onPress={() => onRename(id)}
          >
            Rename
          </DropdownItem>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            startContent={
              <Icon icon="solar:trash-bin-minimalistic-bold" width={14} />
            }
            onPress={() => onDelete(id)}
          >
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
