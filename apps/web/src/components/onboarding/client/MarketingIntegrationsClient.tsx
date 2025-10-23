"use client";

import { addToast } from "@heroui/toast";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import IntegrationCard from "@/components/onboarding/IntegrationCard";
import NavigationButtons from "@/components/onboarding/NavigationButtons";
import StepLoadingState from "@/components/onboarding/StepLoadingState";
import { useUser, useIntegration, useOnboarding } from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";

// Utility function to sanitize URL parameters to prevent XSS (defined outside component)
const sanitizeParam = (param: string | null): string => {
  if (!param) return "";
  // Remove HTML tags and limit length
  return param.replace(/<[^>]*>/g, "").substring(0, 500);
};

const clearParams = (
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  keys: string[]
) => {
  const next = new URLSearchParams(searchParams);
  keys.forEach((k) => next.delete(k));
  const url = `${window.location.pathname}${next.toString() ? `?${next.toString()}` : ""}`;
  router.replace(url as Route);
};

export default function MarketingIntegrationsClient() {
  const [metaLoading, setMetaLoading] = useState(false);

  const user = useUser();
  const { meta } = useIntegration();
  const { status } = useOnboarding();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Guard against double-effects in React Strict Mode to avoid duplicate toasts
  const handledRef = useRef<{ error?: boolean; meta?: boolean }>({});

  // Check prerequisites: must have Shopify connection and subscription
  useEffect(() => {
    if (status && !status.connections.shopify) {
      router.push("/onboarding/shopify");
    } else if (status && !status.hasShopifySubscription) {
      router.push("/onboarding/billing");
    }
  }, [status, router]);

  // Prefetch next pages for faster navigation (accounts → products)
  useEffect(() => {
    router.prefetch("/onboarding/accounts");
    router.prefetch("/onboarding/products");
  }, [router]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("marketing");
  }, []);

  // Derived integration state (memoized)
  const _hasMetaAccounts = useMemo(
    () => Boolean(meta.accounts && meta.accounts.length > 0),
    [meta.accounts]
  );

  // Handle error parameters from OAuth callbacks
  useEffect(() => {
    const error = sanitizeParam(searchParams.get("error"));
    const message = sanitizeParam(searchParams.get("message"));
    const details = sanitizeParam(searchParams.get("details"));
    const metaConnected = searchParams.get("meta_connected");

    if (error && !handledRef.current.error) {
      handledRef.current.error = true;
      let errorMessage = message || "Connection failed";
      let errorTitle = "Connection Error";

      // Platform-specific error handling
      if (error === "no_ad_accounts") {
        errorTitle = "No Ad Accounts Found";
        errorMessage =
          message ||
          "Please ensure you have access to at least one Meta ad account and try again.";
      } else if (error === "no_google_ad_accounts") {
        errorTitle = "No Google Ads Accounts";
        errorMessage =
          message ||
          "Please ensure you have access to at least one Google Ads account.";
      } else if (error === "meta_api_error") {
        errorTitle = "Meta Connection Error";
        errorMessage =
          message ||
          "Failed to retrieve ad accounts from Meta. Please try again.";
      } else if (error === "callback_error") {
        errorTitle = "Connection Failed";
        errorMessage =
          details ||
          "An error occurred during the connection process. Please try again.";
      } else if (error === "missing_parameters") {
        errorTitle = "Authorization Failed";
        errorMessage = "Please try connecting again.";
      } else if (error === "no_access_token") {
        errorTitle = "Authentication Failed";
        errorMessage = "Failed to authenticate. Please try again.";
      }

      // Clear params first to minimize duplicate processing in Strict Mode
      clearParams(router, searchParams, ["error", "message", "details"]);
      addToast({
        title: errorTitle,
        description: errorMessage,
        color: "danger",
        timeout: 10000, // Show for longer since these are important errors
      });
    }

    // Success toasts removed per onboarding policy; just clear params
    if (metaConnected === "true" && !handledRef.current.meta) {
      handledRef.current.meta = true;
      clearParams(router, searchParams, ["meta_connected"]);
    }
  }, [searchParams, router]);

  const handleMetaConnect = useCallback(async () => {
    console.log("[ONBOARDING] Initiating Meta OAuth");
    // Redirect to Meta OAuth
    setMetaLoading(true);
    trackOnboardingAction("marketing", "connect_meta_click");
    window.location.href = `/api/v1/meta/auth`;
  }, []);

  const handleContinue = useCallback(async () => {
    try {
      // Do not force-jump to Costs. Let NavigationButtons
      // advance the server step and navigate to the next route.
      trackOnboardingAction("marketing", "continue");
    } catch (error) {
      console.error(
        "[ONBOARDING] Failed to continue from marketing step:",
        error
      );
      addToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to continue. Please try again.",
        color: "danger",
        timeout: 3000,
      });
    }
  }, []);

  if (!user) {
    return <StepLoadingState message="Loading your profile..." />;
  }

  return (
    <>
      {/* Integration Cards */}
      <div className="space-y-3 sm:space-y-4">
        <div className="space-y-4">
          <IntegrationCard
            description={
              user?.hasMetaConnection
                ? "Connected"
                : "Facebook & Instagram advertising"
            }
            icon="logos:meta-icon"
            isConnected={user?.hasMetaConnection}
            isLoading={metaLoading}
            name="Meta Ads"
            onConnect={handleMetaConnect}
          />
        </div>

        <div className="space-y-4">
          <IntegrationCard
            comingSoon
            comingSoonLabel="Coming soon"
            description="Google Ads integration is coming soon."
            icon="logos:google-ads"
            isConnected={false}
            name="Google Ads"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <NavigationButtons
        nextLabel="Continue"
        onNext={async () => {
          await handleContinue();
          return true; // Allow navigation
        }}
      />
    </>
  );
}
