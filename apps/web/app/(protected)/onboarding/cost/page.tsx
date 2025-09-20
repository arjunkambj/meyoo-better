import SimpleCostsClient from "@/components/onboarding/client/SimpleCostsClient";

export default function CostPage() {
  return (
    <section className="max-w-7xl mx-auto">
      {/* Global tax input removed; SimpleCostsClient no longer sets tax % */}
      <SimpleCostsClient />
    </section>
  );
}
