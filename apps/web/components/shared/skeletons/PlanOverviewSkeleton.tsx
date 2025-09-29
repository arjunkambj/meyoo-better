"use client";

import { Skeleton } from "@heroui/react";

export function PlanOverviewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header with plan chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="h-4 w-20 rounded-md ml-auto" />
          <Skeleton className="h-3 w-28 rounded-md ml-auto" />
        </div>
      </div>

      {/* Usage snapshot */}
      <div className="rounded-lg bg-content1/40 px-3 py-3">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>

      {/* Upgrade recommendation placeholder */}
      <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
        <div className="flex items-start gap-2.5">
          <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-48 max-w-full rounded-md" />
            <Skeleton className="h-3 w-36 max-w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanOverviewSkeleton;
