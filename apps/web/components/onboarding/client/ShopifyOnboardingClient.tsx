"use client";

import { addToast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import IntegrationCard from "@/components/onboarding/IntegrationCard";
import SimpleNavigationButtons from "@/components/onboarding/SimpleNavigationButtons";
import StepLoadingState from "@/components/onboarding/StepLoadingState";
import { useCurrentUser } from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

type Props = { installUri?: string | null };

export default function ShopifyOnboardingClient({ installUri }: Props) {
  const user = useCurrentUser();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);
  // Pending installation claim flow removed

  // Prefetch next page for faster navigation
  useEffect(() => {
    if (user?.hasShopifyConnection) {
      router.prefetch("/onboarding/billing");
    }
  }, [user?.hasShopifyConnection, router]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("shopify");
  }, []);

  if (!user) {
    return <StepLoadingState message="Loading your profile..." />;
  }

  return (
    <>
      {/* Integration Card */}
      <div>
        <IntegrationCard
          description="Connect your Shopify store to start tracking profits"
          icon="logos:shopify"
          isConnected={user?.hasShopifyConnection || false}
          isLoading={connecting}
          name="Shopify Store"
          required={true}
          onConnect={() => {
            if (user?.hasShopifyConnection) return;
            if (installUri) {
              try {
                trackOnboardingAction("shopify", "connect_click");
                setConnecting(true);
                setNavigationPending(true);
                window.location.href = installUri;
              } catch (e) {
                console.error("Failed to navigate to APP install URI", e);
                addToast({
                  title: "Navigation failed",
                  description: "Please try again or contact support.",
                  color: "danger",
                  timeout: 5000,
                });
                setConnecting(false);
                setNavigationPending(false);
              }
            } else {
              // Non-error toast removed per onboarding policy
            }
          }}
          // Disconnect hidden during onboarding
        />
      </div>

      {/* Action Buttons */}
      <SimpleNavigationButtons
        isNextDisabled={!user?.hasShopifyConnection}
        nextLabel={user?.hasShopifyConnection ? "Continue" : "Connect Shopify"}
        showPrevious={false}
        onNext={user?.hasShopifyConnection ? async () => {
          trackOnboardingAction("shopify", "continue");
          router.push("/onboarding/billing");
          return true;
        } : undefined}
      />
    </>
  );
}
