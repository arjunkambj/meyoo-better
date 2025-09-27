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
    <div
      className={`group relative flex items-center rounded-lg gap-1 transition-all duration-200 ${
        active
          ? "bg-primary/10 ring-1 ring-primary/20"
          : "bg-default-100 dark:bg-default-200 hover:bg-default-200 hover:dark:bg-default-300/50"
      }`}
    >
      <Link
        href={`#${id}`}
        className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
          active
            ? "text-primary-600"
            : "text-default-700 hover:text-default-900"
        }`}
        onClick={(e) => {
          e.preventDefault();
          onSelect(id);
        }}
      >
        <Icon
          icon={
            active
              ? "solar:chat-round-dots-bold-duotone"
              : "solar:chat-round-line-duotone"
          }
          width={18}
          className={active ? "text-primary" : "text-default-400"}
        />
        <div className="truncate flex-1">{title}</div>
      </Link>
      <Dropdown placement="bottom-end">
        <DropdownTrigger className="transition-opacity duration-200">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="md"
            aria-label="More actions"
            className="mr-1 hover:bg-default-200"
          >
            <Icon
              icon="solar:menu-dots-bold-duotone"
              width={18}
              className="text-default-500"
            />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Chat actions" className="min-w-[140px]">
          <DropdownItem
            key="rename"
            startContent={
              <Icon
                icon="solar:pen-2-bold-duotone"
                width={16}
                className="text-default-600"
              />
            }
            onPress={() => onRename(id)}
            className="text-default-700"
          >
            Rename
          </DropdownItem>
          <DropdownItem
            key="delete"
            className="text-danger"
            color="danger"
            startContent={
              <Icon icon="solar:trash-bin-trash-bold-duotone" width={16} />
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
