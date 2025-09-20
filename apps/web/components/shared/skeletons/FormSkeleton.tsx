"use client";

import { Skeleton } from "@heroui/react";

interface FormSkeletonProps {
  fields?: number;
  showAvatar?: boolean;
  className?: string;
}

export function FormSkeleton({
  fields = 4,
  showAvatar = false,
  className = "",
}: FormSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-48 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>

      <Skeleton className="h-px w-full rounded-lg" />

      {/* Avatar Section */}
      {showAvatar && (
        <div className="flex items-center gap-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-64 rounded-lg" />
            <Skeleton className="h-3 w-48 rounded-lg" />
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={`field-${i + 1}`} className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-10 w-20 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export default FormSkeleton;
