import { Icon } from "@iconify/react";
import CompleteOnboardingClient from "@/components/onboarding/client/CompleteOnboardingClient";

export default function CompletePage() {
  return (
    <div className="max-w-2xl mx-auto px-2">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Icon className="text-foreground" icon="solar:check-circle-bold" />
          <h1 className="text-3xl lg:text-4xl font-bold text-default-900">
            Setup Complete!
          </h1>
        </div>
        <p className="text-lg text-default-600">
          Your account is ready. Let&apos;s calculate your analytics.
        </p>
      </div>

      {/* Client Component */}
      <CompleteOnboardingClient />
    </div>
  );
}
