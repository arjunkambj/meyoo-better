import VariantCostsClient from "@/components/onboarding/client/VariantCostsClient";

export default function ProductsPage() {
  return (
    <section className="max-w-7xl mx-auto">
      <VariantCostsClient
        hideTitle={false}
        hideSearch
        hideRowSave={true}
        compact={true}
        hideShipping={true} // Shipping is handled globally in cost page
        hideHandling={false} // Handling is per-variant
      />
    </section>
  );
}
