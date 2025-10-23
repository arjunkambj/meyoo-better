"use client";

import { Card } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
import { KPISkeleton } from "@/components/shared/cards/KPI";

export function PinnedMetricsGridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <KPISkeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={`kpi-${i}`}
            showIcon
            size="small"
          />
        ))}
      </div>
    </div>
  );
}

export function UnpinnedMetricsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <KPISkeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={`unpinned-kpi-${i}`}
            showIcon
            size="small"
          />
        ))}
      </div>
    </div>
  );
}

export function WidgetSkeleton({
  variant = "default",
}: {
  variant?: "default" | "large";
}) {
  if (variant === "large") {
    // Cost Breakdown Widget Skeleton
    return (
      <Card
        className="p-5 bg-default-100 dark:bg-content1 border border-default-50 rounded-2xl h-full"
        shadow="none"
      >
        <div className="mb-3.5 pb-3.5 border-b border-divider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
          <Skeleton className="hidden sm:block h-8 w-24 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <Skeleton className="h-44 w-44 rounded-full" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
                  key={i}
                  className="bg-background border border-default-50 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-16 rounded-md" />
                        <Skeleton className="h-2.5 w-12 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-14 rounded-md" />
                  </div>
                  <Skeleton className="mt-2 h-1 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Default widget skeleton (Order Summary, Customer Summary, etc.)
  return (
    <Card
      className="p-5 bg-default-100 dark:bg-content1 border border-default-50 rounded-2xl h-full"
      shadow="none"
    >
      <div className="mb-3.5 pb-3.5 border-b border-divider">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="py-2 px-3 bg-background border border-default-50 rounded-xl">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        </div>

        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={i}
            className="py-2.5 px-3 border-b border-default-200 last:border-0"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48 rounded-md mb-2" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Sync Status Bar Skeleton */}
      <div className="flex items-center gap-2 p-2 bg-default-50 rounded-lg">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </div>

      {/* KPI Metrics Grid */}
      <div className="mb-8">
        <PinnedMetricsGridSkeleton />
      </div>

      {/* Widgets */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-md" />

        {/* Cost Breakdown Widget */}
        <WidgetSkeleton variant="large" />

        {/* Other Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <WidgetSkeleton />
          <WidgetSkeleton />
          <WidgetSkeleton />
        </div>
      </div>
    </div>
  );
}
