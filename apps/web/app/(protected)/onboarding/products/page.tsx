import VariantCostsClient from "@/components/onboarding/client/VariantCostsClient";

export default function ProductsPage() {
  return (
    <section className="max-w-7xl mx-auto">
      <VariantCostsClient
        hideTitle={false}
        hideSearch
        hideRowSave={true}
        compact={true}
        hideShipping={true}
        hideHandling={false}
      />
    </section>
  );
}
