"use client";

import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import IntegrationCard from "@/components/onboarding/IntegrationCard";
import SimpleNavigationButtons from "@/components/onboarding/SimpleNavigationButtons";
import StepLoadingState from "@/components/onboarding/StepLoadingState";
import { useOnboarding, useUser } from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { api } from "@/libs/convexApi";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

type Props = { installUri?: string | null };

export default function ShopifyOnboardingClient({ installUri }: Props) {
  const user = useUser();
  const { status: onboardingStatus } = useOnboarding();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const joinDemoOrganization = useMutation(
    api.core.onboarding.joinDemoOrganization
  );
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [joiningDemo, setJoiningDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const suppressCancelTracking = useRef(false);
  const signupEventSentRef = useRef(false);
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

  useEffect(() => {
    if (signupEventSentRef.current) return;
    if (!onboardingStatus) return;
    if (onboardingStatus.hasShopifySubscription) return;

    let cancelled = false;

    (async () => {
      try {
        await fetch("/api/v1/tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "signup.created",
          }),
        });
      } catch {
        // Swallow tracking errors to avoid interrupting onboarding.
      } finally {
        if (!cancelled) {
          signupEventSentRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onboardingStatus]);

  const handleOpenDemoModal = () => {
    trackOnboardingAction("shopify", "join_demo_open");
    setDemoError(null);
    suppressCancelTracking.current = false;
    setIsDemoModalOpen(true);
  };

  const handleDismissDemoModal = (suppressTracking = false) => {
    if (joiningDemo && !suppressTracking) {
      return;
    }
    suppressCancelTracking.current = suppressTracking;
    setIsDemoModalOpen(false);
    setDemoError(null);
  };

  const handleJoinDemo = async () => {
    if (joiningDemo) {
      return;
    }
    trackOnboardingAction("shopify", "join_demo_confirm");
    setJoiningDemo(true);
    setDemoError(null);
    setNavigationPending(true);
    try {
      const result = await joinDemoOrganization({});
      if (result.success) {
        trackOnboardingAction("shopify", "join_demo_success");
        addToast({
          title: "Demo workspace enabled",
          description:
            "You now have access to Meyoo's demo data set to explore the dashboard.",
          color: "success",
          timeout: 4000,
        });
        handleDismissDemoModal(true);
        router.refresh();
      } else {
        setDemoError(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to join the demo workspace.";
      setDemoError(message);
    } finally {
      setJoiningDemo(false);
      setNavigationPending(false);
    }
  };

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

      {/* Demo access CTA */}
      {!user?.hasShopifyConnection && (
        <>
          <div className="relative my-10">
            <Divider />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4">
              <span className="text-xs font-medium text-default-400">OR</span>
            </div>
          </div>

          <div className="rounded-lg border border-default-200 bg-default-50 p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="rounded-full bg-default-100 p-3">
                <Icon
                  aria-hidden="true"
                  className="text-default-600"
                  icon="solar:planet-bold-duotone"
                  width={24}
                />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-base font-medium text-default-900">
                  Don&apos;t have a store yet?
                </h3>
                <p className="text-sm text-default-600">
                  Explore Meyoo with our demo workspace to see how it works
                </p>
              </div>
              <Button
                color="default"
                variant="flat"
                radius="lg"
                size="md"
                startContent={
                  <Icon
                    aria-hidden="true"
                    icon="solar:play-circle-bold-duotone"
                    width={18}
                  />
                }
                onPress={handleOpenDemoModal}
              >
                View Demo
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Action Buttons */}
      <SimpleNavigationButtons
        isNextDisabled={!user?.hasShopifyConnection}
        nextLabel={
          user?.hasShopifyConnection ? "Continue" : "Continue Onboarding"
        }
        showPrevious={false}
        onNext={
          user?.hasShopifyConnection
            ? async () => {
                trackOnboardingAction("shopify", "continue");
                router.push("/onboarding/billing");
                return true;
              }
            : undefined
        }
      />

      <Modal
        isDismissable={!joiningDemo}
        isOpen={isDemoModalOpen}
        size="md"
        hideCloseButton={joiningDemo}
        placement="center"
        onOpenChange={(open) => {
          if (!open) {
            if (!suppressCancelTracking.current) {
              trackOnboardingAction("shopify", "join_demo_cancel");
            }
            suppressCancelTracking.current = false;
            setIsDemoModalOpen(false);
            setDemoError(null);
          } else {
            suppressCancelTracking.current = false;
            setIsDemoModalOpen(true);
          }
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-default-900">
                  Join Demo Workspace
                </h2>
              </ModalHeader>
              <ModalBody className="gap-4 pb-6">
                {demoError && (
                  <div className="flex items-start gap-2 rounded-lg bg-danger/10 p-3">
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 flex-shrink-0 text-danger"
                      icon="solar:danger-triangle-bold"
                      width={18}
                    />
                    <p className="text-sm text-danger">{demoError}</p>
                  </div>
                )}

                <p className="text-sm text-default-600">
                  Explore the dashboard with sample e-commerce data. You can
                  leave anytime from team settings.
                </p>
              </ModalBody>
              <ModalFooter className="gap-2">
                <Button
                  variant="flat"
                  isDisabled={joiningDemo}
                  onPress={() => handleDismissDemoModal()}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={joiningDemo}
                  onPress={handleJoinDemo}
                >
                  {joiningDemo ? "Joining..." : "Join Demo"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
