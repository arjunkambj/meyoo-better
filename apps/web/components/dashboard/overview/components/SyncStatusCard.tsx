"use client";

import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";

import type {
  InitialSyncCardData,
  SyncCardState,
} from "@/hooks/mainapp/useInitialSyncStatus";

type Props = {
  isLoading: boolean;
  data: InitialSyncCardData | null;
};

type ChipColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger";

const STATE_META: Record<
  SyncCardState,
  { label: string; color: ChipColor; icon: string }
> = {
  syncing: {
    label: "Sync in Progress",
    color: "warning",
    icon: "solar:refresh-circle-bold-duotone",
  },
  waiting: {
    label: "Awaiting Sync",
    color: "primary",
    icon: "solar:clock-circle-broken",
  },
  failed: {
    label: "Sync Failed",
    color: "danger",
    icon: "solar:danger-triangle-bold-duotone",
  },
};

const formatLastUpdated = (timestamp: number | null) => {
  if (!timestamp) {
    return null;
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch (_error) {
    return null;
  }
};

export function SyncStatusCard({ isLoading, data }: Props) {
  if (isLoading && !data) {
    return (
      <Card className="border border-warning-200/70 bg-warning-50/40 dark:border-warning-200/30 dark:bg-warning-100/10">
        <CardBody className="flex items-center gap-2 py-3 text-sm text-warning-700 dark:text-warning-400">
          <Spinner size="sm" color="warning" />
          Checking sync status...
        </CardBody>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const stateMeta = STATE_META[data.state];
  const lastUpdated = formatLastUpdated(data.lastUpdated);
  return (
    <Card className="border border-warning-200/70 bg-warning-50/40 dark:border-warning-200/30 dark:bg-warning-100/10">
      <CardBody className="space-y-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Chip
              color={stateMeta.color}
              variant="flat"
              className="px-2"
              startContent={
                data.state === "syncing" ? (
                  <Spinner size="sm" color={stateMeta.color} />
                ) : (
                  <Icon icon={stateMeta.icon} width={14} />
                )
              }
            >
              {stateMeta.label}
            </Chip>
            <p className="text-sm font-medium text-default-700">
              {data.message}
            </p>
          </div>
          {lastUpdated && (
            <p className="text-xs text-default-400">{lastUpdated}</p>
          )}
        </div>

        {data.error && (
          <div className="rounded-md bg-danger-50/60 px-3 py-2 text-xs text-danger-600 dark:bg-danger-100/10 dark:text-danger-400">
            {data.error}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
