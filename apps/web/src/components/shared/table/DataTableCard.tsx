"use client";

import { Skeleton } from "@heroui/skeleton";
import type { ReactNode } from "react";

import { cn } from "@/libs/utils";

export const DATA_TABLE_CONTAINER_CLASS =
  "rounded-3xl bg-content2 dark:bg-content1 backdrop-blur-md";
export const DATA_TABLE_INNER_CLASS = "space-y-4 p-5 sm:p-6";
export const DATA_TABLE_TABLE_CLASS =
  "rounded-2xl border border-default-200/60 bg-content1 overflow-hidden";
export const DATA_TABLE_HEADER_CLASS =
  "bg-transparent text-default-600 font-semibold uppercase tracking-wide text-[11px]";
export const DATA_TABLE_GROUP_ROW_BORDER_CLASS =
  "border-t border-default-border";
export const DATA_TABLE_ROW_BASE_BG = "bg-background";
export const DATA_TABLE_ROW_STRIPE_BG =
  "bg-default-50 dark:bg-content1/50";
export const DATA_TABLE_ROW_STRIPE_CHILD_BG =
  "bg-default-50/40 dark:bg-content1/30";
export const DATA_TABLE_SIMPLE_ROW_STRIPE_CLASS =
  "bg-background even:bg-default-50 dark:even:bg-content1/50 border-t border-default-border";
export const DATA_TABLE_INPUT_WRAPPER_CLASS =
  "bg-default-100 dark:bg-content2 focus-within:ring-1 focus-within:ring-default-200";
export const DATA_TABLE_INPUT_CLASS = "text-sm text-default-900";

interface DataTableCardProps {
  children: ReactNode;
  className?: string;
  topContent?: ReactNode;
  footerContent?: ReactNode;
  loading?: boolean;
  /** Number of skeleton rows to render when loading */
  skeletonRows?: number;
  /** Custom skeleton content for loading states */
  skeletonContent?: ReactNode;
  /** Height to use for the default skeleton rows */
  skeletonRowClassName?: string;
}

export function DataTableCard({
  children,
  className,
  topContent,
  footerContent,
  loading,
  skeletonRows = 5,
  skeletonContent,
  skeletonRowClassName = "h-12 w-full rounded-lg",
}: DataTableCardProps) {
  return (
    <section className={cn(DATA_TABLE_CONTAINER_CLASS, className)}>
      <div className={DATA_TABLE_INNER_CLASS}>
        {topContent}
        {loading
          ? (skeletonContent ?? (
              <div className="space-y-3">
                {Array.from({ length: skeletonRows }, (_, index) => (
                  <Skeleton
                    key={`data-table-card-skeleton-${index}`}
                    className={skeletonRowClassName}
                  />
                ))}
              </div>
            ))
          : children}
        {footerContent}
      </div>
    </section>
  );
}
