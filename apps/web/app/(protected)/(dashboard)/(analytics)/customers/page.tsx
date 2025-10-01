"use client";

import { Suspense } from "react";
import { CustomersView } from "@/components/dashboard/(analytics)/customers/CustomersView";
import { Skeleton, Spacer } from "@heroui/react";

function CustomersLoading() {
  return (
    <div className="flex flex-col space-y-6">
      <Spacer y={0.5} />
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-[600px] rounded-lg" />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<CustomersLoading />}>
      <CustomersView />
    </Suspense>
  );
}
