"use client";

import { Card, Skeleton } from "@heroui/react";

export function PinnedMetricsGridSkeleton() {
  return (
    <div className="space-y-4">
      {/* Simplified responsive grid matching MetricsContainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={`kpi-${i}`}
            className="p-4 bg-content1 rounded-2xl border border-divider h-[120px]"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-start justify-between mb-2">
                <Skeleton className="h-3.5 w-20 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
              <Skeleton className="h-7 w-24 rounded-md mb-1" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-3.5 w-12 rounded-md" />
              </div>
            </div>
          </Card>
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
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={i}
            className="p-4 bg-content1 rounded-2xl border border-divider h-[120px]"
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-start justify-between mb-2">
                <Skeleton className="h-3.5 w-20 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
              <Skeleton className="h-7 w-24 rounded-md mb-1" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-3.5 w-12 rounded-md" />
              </div>
            </div>
          </Card>
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
      <Card className="p-5 bg-content1 rounded-2xl border border-divider">
        <div className="mb-4">
          <Skeleton className="h-3.5 w-32 rounded-md mb-1" />
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 flex items-center justify-center">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
                  key={i}
                  className="bg-default-50 dark:bg-default-50/50 rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-md mb-1" />
                  <Skeleton className="h-2.5 w-24 rounded-md mb-0.5" />
                  <Skeleton className="h-2.5 w-20 rounded-md" />
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
    <Card className="p-5 bg-content1 rounded-2xl border border-divider h-full">
      <div className="mb-3">
        <Skeleton className="h-3.5 w-32 rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton components use index-based keys as they don't represent real data
            key={i}
            className="py-2"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-24 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-3 w-10 rounded-md" />
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
