"use client";

import { Suspense } from "react";
import { OrdersView } from "@/components/dashboard/(analytics)/orders/OrdersView";
import { Skeleton, Spacer } from "@heroui/react";

function OrdersLoading() {
  return (
    <div className="flex flex-col space-y-6">
      <Spacer y={0.5} />
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[600px] rounded-lg" />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersView />
    </Suspense>
  );
}
