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
    hasShopifySyncError,
    shopifySyncStatus,
    shopifySyncProgress,
    isInitialSyncComplete,
    pendingSyncPlatforms,
    syncStatus,
    shopifySyncState,
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
      }, 1200);
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
  }, [hasShopify, router, finishOnboarding, isCompleting, isCompleted]);

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

  const hasRequiredConnections = hasShopify;
  const shopifyOverall = shopifySyncState as
    | 'unsynced'
    | 'syncing'
    | 'complete'
    | 'failed'
    | undefined;
  type Overall = 'unsynced' | 'syncing' | 'complete' | 'failed';
  const metaOverall = (syncStatus?.meta as { overallState?: Overall } | undefined)?.overallState as
    | Overall
    | undefined;
  const activePlatforms = [
    ...(shopifyOverall === 'syncing' || hasShopifySyncError ? ['shopify'] : []),
    ...(metaOverall === 'syncing' ? ['meta'] : []),
  ];

  const syncStatusLabel = (() => {
    if (isInitialSyncComplete) return 'completed';
    if (shopifyOverall) {
      if (shopifyOverall === 'complete') return 'completed';
      if (shopifyOverall === 'unsynced') return 'not started';
      return shopifyOverall.replace(/_/g, ' ');
    }
    return shopifySyncStatus ? shopifySyncStatus.replace(/_/g, ' ') : 'not started';
  })();
  const shopifyOrdersProcessed = shopifySyncProgress.ordersProcessed;
  const shopifyOrdersQueued = shopifySyncProgress.ordersQueued;
  const shopifyTotalOrdersSeen = shopifySyncProgress.totalOrdersSeen as
    | number
    | null
    | undefined;
  const shopifyRecordsProcessed = shopifySyncProgress.recordsProcessed;
  const shopifyProgressText = (() => {
    if (typeof shopifyOrdersProcessed === "number") {
      const denom =
        typeof shopifyTotalOrdersSeen === "number"
          ? shopifyTotalOrdersSeen
          : typeof shopifyOrdersQueued === "number" && shopifyOrdersQueued > 0
            ? shopifyOrdersQueued
            : undefined;
      const suffix = denom !== undefined ? ` of ${denom}` : "";
      return `Orders processed: ${shopifyOrdersProcessed}${suffix}`;
    }
    if (shopifyRecordsProcessed) {
      return `Records processed: ${shopifyRecordsProcessed}`;
    }
    return null;
  })();
  const syncingDescription = hasShopifySyncError
    ? "The initial Shopify sync failed. You can finish setup now, but we recommend retrying the sync from the Shopify step so analytics stay accurate."
    : activePlatforms.length > 0
      ? `We’re still importing ${activePlatforms.join(", ")} data. This can take a few minutes for larger stores, but you can continue while we finish.`
      : "We’re still importing orders and products from Shopify. This can take a few minutes for larger stores, but you can continue while we finish.";

  return (
    <>
      {activePlatforms.length > 0 && (
        <Card className="border-warning bg-warning-50/40 mb-8">
          <CardBody className="flex flex-col gap-3 text-default-700">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-none text-warning-500">
                <Icon icon="solar:refresh-circle-line-duotone" width={24} />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-warning-600">
                  {activePlatforms.length > 0
                    ? `${activePlatforms.map((platform) =>
                        platform === "shopify"
                          ? "Shopify"
                          : platform === "meta"
                            ? "Meta"
                            : platform,
                      ).join(", ")} sync ${hasShopifySyncError ? "needs attention" : "is still running"}`
                    : hasShopifySyncError
                      ? "Shopify sync needs attention"
                      : "Sync is still running"}
                </p>
                <p className="text-sm leading-relaxed">
                  {syncingDescription}
                </p>
                {activePlatforms.includes("shopify") && (
                  <p className="text-xs uppercase tracking-wide text-warning-500">
                    Status: {syncStatusLabel}
                    {shopifyProgressText ? ` • ${shopifyProgressText}` : ""}
                  </p>
                )}
                {activePlatforms.includes("meta") && syncStatus?.meta?.status && (
                  <p className="text-xs uppercase tracking-wide text-warning-500">
                    Meta status: {syncStatus.meta.status.replace(/_/g, " ")}
                  </p>
                )}
              </div>
            </div>
            {!hasShopifySyncError && (
              <div className="flex items-center gap-2 text-warning-500">
                <Spinner size="sm" color="warning" />
                <span className="text-xs">
                  You can finish setup now. We&apos;ll continue syncing and update analytics once everything lands.
                </span>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {pendingSyncPlatforms.length > 0 && (
        <Card className="border-primary mb-8">
          <CardBody className="flex flex-col gap-2 text-default-700">
            <p className="font-medium text-primary">
              We’re still syncing {pendingSyncPlatforms.join(", ")}
            </p>
            <p className="text-sm">
              Feel free to explore the dashboard. Analytics will refresh automatically once the remaining imports finish.
            </p>
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
