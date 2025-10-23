"use client";

import { Button } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
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
      className={`group relative flex items-center rounded-xl gap-1 transition-all duration-200 ${
        active
          ? "bg-primary/10 ring-2 ring-primary/30"
          : "bg-default-200/50 hover:bg-default-200/70 hover:ring-1 hover:ring-default-200"
      }`}
    >
      <Link
        href={`#${id}`}
        className={`flex-1 flex items-center gap-2.5 px-3.5 py-3 text-sm font-medium transition-colors ${
          active ? "text-primary" : "text-default-700 hover:text-default-900"
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
          width={20}
          className={active ? "text-primary" : "text-default-400"}
        />
        <div className="truncate flex-1">{title}</div>
      </Link>
      <Dropdown placement="bottom-end">
        <DropdownTrigger className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            aria-label="More actions"
            className="mr-1.5 hover:bg-default-200"
          >
            <Icon
              icon="solar:menu-dots-bold-duotone"
              width={18}
              className="text-default-600"
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
