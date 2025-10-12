import MarketingIntegrationsClient from "@/components/onboarding/client/MarketingIntegrationsClient";

export default function MarketingIntegrationsPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-2xl lg:text-3xl font-bold text-default-900 mb-3">
          Connect Your Marketing Channels
        </h1>
        <p className="text-base text-default-600">
          Connect your advertising platforms to track ROAS and campaign performance
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        <MarketingIntegrationsClient />
      </div>
    </>
  );
}
