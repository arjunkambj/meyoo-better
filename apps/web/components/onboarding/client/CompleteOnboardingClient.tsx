"use client";

import { addToast, Button, Card, CardBody } from "@heroui/react";
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
  const { finishOnboarding, hasShopify, hasMeta, status } =
    useOnboarding();

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

  return (
    <>
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
              : hasRequiredConnections
                ? "All Set & Go to Dashboard"
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
