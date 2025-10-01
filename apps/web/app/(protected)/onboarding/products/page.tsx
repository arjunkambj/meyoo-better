import { Suspense } from "react";
import VariantCostsClient from "@/components/onboarding/client/VariantCostsClient";
import StepLoadingState from "@/components/onboarding/StepLoadingState";

export default function ProductsPage() {
  return (
    <section className="max-w-7xl mx-auto">
      <Suspense fallback={<StepLoadingState message="Loading product costs..." />}>
        <VariantCostsClient
          hideTitle={false}
          hideSearch
          hideRowSave={true}
          compact={true}
          hideHandling={false} // Handling is per-variant
        />
      </Suspense>
    </section>
  );
}
