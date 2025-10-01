import { Suspense } from "react";
import SimpleCostsClient from "@/components/onboarding/client/SimpleCostsClient";
import StepLoadingState from "@/components/onboarding/StepLoadingState";

export default function CostPage() {
  return (
    <section className="max-w-7xl mx-auto">
      {/*
        Global cost settings:
        - Operating costs (monthly fixed)
        - Shipping cost (per order)
        - Payment fee percentage

        Per-variant costs are set in the Products page:
        - COGS per unit
        - Tax percentage
        - Handling per unit
      */}
      <Suspense fallback={<StepLoadingState message="Loading cost settings..." />}>
        <SimpleCostsClient />
      </Suspense>
    </section>
  );
}
