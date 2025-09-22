"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";
import type { GenericId as Id } from "convex/values";
import type { ApiKey } from "@/hooks/useApiKeys";

interface ApiKeyTableProps {
  apiKeys: ApiKey[];
  onDelete: (id: Id<"apiKeys">, name: string) => void;
  deletingId: Id<"apiKeys"> | null;
}

export default function ApiKeyTable({
  apiKeys,
  onDelete,
  deletingId,
}: ApiKeyTableProps) {
  const formatRelative = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const columns = [
    { key: "name", label: "NAME" },
    { key: "key", label: "PREFIX" },
    { key: "status", label: "STATUS" },
    { key: "lastUsed", label: "LAST USED" },
    { key: "created", label: "CREATED" },
    { key: "actions", label: "ACTIONS" },
  ];

  const renderCell = (item: ApiKey, columnKey: string) => {
    switch (columnKey) {
      case "name":
        return <span className="text-sm font-medium text-foreground">{item.name}</span>;
      case "key":
        return <span className="font-mono text-xs text-default-500">{item.prefix}…</span>;
      case "status":
        return (
          <Chip
            size="sm"
            variant="flat"
            color={item.isActive ? "success" : "danger"}
          >
            {item.isActive ? "Active" : "Revoked"}
          </Chip>
        );
      case "lastUsed":
        return (
          <span className="text-sm text-default-500">
            {item.lastUsed ? formatRelative(item.lastUsed) : "Never"}
          </span>
        );
      case "created":
        return (
          <span className="text-sm text-default-500">
            {formatRelative(item.createdAt)}
          </span>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Tooltip content="Delete API key" color="danger" delay={0}>
              <Button
                isIconOnly
                size="sm"
                color="danger"
                variant="light"
                isLoading={deletingId === item._id}
                isDisabled={!item.isActive}
                onPress={() => onDelete(item._id, item.name)}
              >
                <Icon icon="solar:trash-bin-trash-bold" width={16} />
              </Button>
            </Tooltip>
          </div>
        );
      default:
        return null;
    }
  };

  if (apiKeys.length === 0) {
    return (
      <div className="text-center py-8">
        <Icon
          icon="solar:key-minimalistic-square-2-bold-duotone"
          className="text-default-300 mx-auto mb-4"
          width={48}
        />
        <p className="text-default-500">No API keys yet</p>
        <p className="text-sm text-default-400 mt-1">
          Generate your first API key to get started
        </p>
      </div>
    );
  }

  return (
    <Table aria-label="API keys table">
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn key={column.key}>{column.label}</TableColumn>
        )}
      </TableHeader>
      <TableBody items={apiKeys}>
        {(item) => (
          <TableRow key={item._id}>
            {(columnKey) => (
              <TableCell>{renderCell(item, columnKey as string)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
