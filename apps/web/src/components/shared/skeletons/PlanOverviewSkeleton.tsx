"use client";

import { Skeleton } from "@heroui/skeleton";
export function PlanOverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="space-y-1 text-right">
          <Skeleton className="ml-auto h-4 w-20 rounded-md" />
          <Skeleton className="ml-auto h-3 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

export default PlanOverviewSkeleton;
