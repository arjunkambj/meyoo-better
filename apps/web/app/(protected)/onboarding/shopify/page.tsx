import ShopifyOnboardingClient from "@/components/onboarding/client/ShopifyOnboardingClient";
import { requireEnv } from "@/libs/env";

export default function ShopifyOnboardingPage() {
  const installUri = requireEnv("NEXT_PUBLIC_APP_INSTALL_URI");
  return (
    <section className="max-w-3xl mx-auto h-full">
      {/* Header */}
      <div className="mb-12 text-center flex flex-col lg:text-left">
        <h1 className="text-2xl lg:text-3xl font-bold text-default-900 mb-2">
          Connect Your Shopify Store
        </h1>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Client Component for Interactive Parts */}
        <ShopifyOnboardingClient installUri={installUri} />
      </div>
    </section>
  );
}
