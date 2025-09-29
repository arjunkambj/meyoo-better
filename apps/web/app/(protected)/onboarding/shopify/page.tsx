import ShopifyOnboardingClient from "@/components/onboarding/client/ShopifyOnboardingClient";
import { requireEnv } from "@/libs/env";

export default function ShopifyOnboardingPage() {
  const installUri = requireEnv("NEXT_PUBLIC_APP_INSTALL_URI");
  return (
    <section className="max-w-3xl mx-auto h-full">
      {/* Header */}
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-2xl lg:text-3xl font-bold text-default-900 mb-3">
          Connect Your Shopify Store
        </h1>
        <p className="text-base text-default-600">
          Connect your store to start tracking your profits and performance
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Client Component for Interactive Parts */}
        <ShopifyOnboardingClient installUri={installUri} />
      </div>
    </section>
  );
}
