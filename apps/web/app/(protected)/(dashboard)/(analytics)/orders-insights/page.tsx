"use client";

import { Suspense } from "react";
import { OrdersInsightsView } from "@/components/dashboard/(analytics)/orders-insights/OrdersInsightsView";
import { Skeleton, Spacer } from "@heroui/react";

function OrdersInsightsLoading() {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
      <Skeleton className="h-[350px] rounded-lg" />
    </div>
  );
}

export default function OrdersInsightsPage() {
  return (
    <Suspense fallback={<OrdersInsightsLoading />}>
      <OrdersInsightsView />
    </Suspense>
  );
}
