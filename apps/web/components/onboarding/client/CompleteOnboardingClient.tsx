"use client";

import { addToast, Button, Card, CardBody, Spinner } from "@heroui/react";
import { cn } from "@heroui/theme";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useOnboarding } from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";

export default function CompleteOnboardingClient() {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const router = useRouter();
  const {
    finishOnboarding,
    hasShopify,
    hasMeta,
    status,
    isShopifySynced,
    hasShopifySyncError,
    shopifySyncStatus,
    shopifySyncProgress,
  } = useOnboarding();

  // (features list removed; unused)

  // Check prerequisites: must have completed previous steps
  useEffect(() => {
    if (status && !status.connections.shopify) {
      router.push("/onboarding/shopify");
    } else if (status && !status.hasShopifySubscription) {
      router.push("/onboarding/billing");
    }
  }, [status, router]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("complete");
  }, []);

  const handleComplete = useCallback(async () => {
    // Prevent double submission
    if (isCompleting || isCompleted) {
      return;
    }

    // Validate Shopify connection is required
    if (!hasShopify) {
      console.log("[ONBOARDING] Cannot complete - Shopify not connected");
      router.push("/onboarding/shopify");

      return;
    }

    if (!isShopifySynced) {
      const msg = hasShopifySyncError
        ? "We need to finish importing your Shopify data before completing setup. Please retry the sync from the Shopify step."
        : "We\u2019re still importing your Shopify data. You\u2019ll be able to finish once the sync is complete.";
      addToast({
        title: "Shopify sync in progress",
        description: msg,
        color: "warning",
        timeout: 3500,
      });

      return;
    }

    setIsCompleting(true);

    try {
      console.log("[ONBOARDING] Completing onboarding process");

      // Complete onboarding - this will trigger analytics
      const result = await finishOnboarding();
      trackOnboardingAction("complete", "finish");

      console.log("[ONBOARDING] Onboarding completed:", {
        analyticsScheduled: result.analyticsScheduled,
        platformsSyncing: result.platformsSyncing,
      });

      // Mark as completed to prevent any further submissions
      setIsCompleted(true);

      // Redirect to dashboard immediately
      setTimeout(() => {
        console.log("[ONBOARDING] Redirecting to dashboard");
        trackOnboardingAction("complete", "redirect_dashboard");
        router.push("/overview");
      }, 1000);
    } catch (error) {
      console.error("[ONBOARDING] Failed to complete setup:", error);
      setIsCompleting(false);
      addToast({
        title: "Failed to complete setup",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        color: "danger",
        timeout: 3000,
      });
    }
  }, [
    hasShopify,
    router,
    finishOnboarding,
    isCompleting,
    isCompleted,
    isShopifySynced,
    hasShopifySyncError,
  ]);

  const connectionItems = [
    {
      name: "Shopify Store",
      connected: hasShopify,
      icon: "logos:shopify",
      required: true,
    },
    {
      name: "Meta Ads",
      connected: hasMeta,
      icon: "logos:meta-icon",
      required: false,
    },
  ];

  const hasRequiredConnections = hasShopify && isShopifySynced;
  const syncStatusLabel = shopifySyncStatus
    ? shopifySyncStatus.replace(/_/g, " ")
    : "not started";
  const syncingDescription = hasShopifySyncError
    ? "The initial Shopify sync failed. Please restart the sync from the Shopify step before continuing."
    : "We\u2019re still importing orders and products from Shopify. This can take a few minutes for larger stores.";

  return (
    <>
      {!isShopifySynced && (
        <Card className="border-warning bg-warning-50/40 mb-8">
          <CardBody className="flex flex-col gap-3 text-default-700">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-none text-warning-500">
                <Icon icon="solar:refresh-circle-line-duotone" width={24} />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-warning-600">
                  Shopify sync {hasShopifySyncError ? "needs attention" : "is still running"}
                </p>
                <p className="text-sm leading-relaxed">
                  {syncingDescription}
                </p>
                <p className="text-xs uppercase tracking-wide text-warning-500">
                  Status: {syncStatusLabel}
                  {shopifySyncProgress.recordsProcessed
                    ? ` • Orders processed: ${shopifySyncProgress.recordsProcessed}`
                    : ""}
                </p>
              </div>
            </div>
            {!hasShopifySyncError && (
              <div className="flex items-center gap-2 text-warning-500">
                <Spinner size="sm" color="warning" />
                <span className="text-xs">
                  We&apos;ll enable completion automatically once the sync finishes.
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Connection Summary */}
      <div>
        <h2 className="text-lg font-semibold text-default-900 mb-4">
          Your Connections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {connectionItems.map((item) => (
            <Card
              key={item.name}
              className={cn(
                "relative",
                item.connected ? "border-success" : "border-default-200"
              )}
            >
              <CardBody className="p-4">
                <div key={item.name} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-default-100">
                    <Icon
                      className="w-5 h-5 text-foreground"
                      icon={item.icon}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-default-900">
                      {item.name}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        item.connected
                          ? "text-success font-medium"
                          : "text-default-500"
                      )}
                    >
                      {item.connected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                  {item.required && !item.connected && (
                    <span className="text-xs text-danger">Required</span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="text-center">
        <Button
          color={hasRequiredConnections ? "primary" : "default"}
          endContent={
            !isCompleting && (
              <Icon icon="solar:arrow-right-line-duotone" width={18} />
            )
          }
          isDisabled={!hasRequiredConnections || isCompleted}
          isLoading={isCompleting}
          size="lg"
          onPress={handleComplete}
        >
          {isCompleted
            ? "All Set! Redirecting..."
            : isCompleting
              ? "Finishing setup..."
              : hasShopify
                ? hasRequiredConnections
                  ? "All Set & Go to Dashboard"
                  : hasShopifySyncError
                    ? "Resolve Shopify Sync"
                    : "Waiting for Shopify Sync..."
                : "Connect Shopify to Continue"}
        </Button>

        {!hasShopify && (
          <p className="text-xs text-default-500 mt-4">
            <Link
              className="text-foreground font-medium"
              href="/onboarding/shopify"
            >
              Go back
            </Link>{" "}
            to connect your Shopify store
          </p>
        )}
      </div>
    </>
  );
}
