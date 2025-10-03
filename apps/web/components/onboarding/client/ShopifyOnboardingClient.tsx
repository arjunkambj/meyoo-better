"use client";

import {
  addToast,
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import IntegrationCard from "@/components/onboarding/IntegrationCard";
import SimpleNavigationButtons from "@/components/onboarding/SimpleNavigationButtons";
import StepLoadingState from "@/components/onboarding/StepLoadingState";
import { useCurrentUser } from "@/hooks";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { api } from "@/libs/convexApi";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

type Props = { installUri?: string | null };

export default function ShopifyOnboardingClient({ installUri }: Props) {
  const user = useCurrentUser();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const joinDemoOrganization = useMutation(
    api.core.onboarding.joinDemoOrganization,
  );
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [joiningDemo, setJoiningDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const suppressCancelTracking = useRef(false);
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
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Icon
            aria-hidden="true"
            className="text-primary"
            icon="solar:planet-bold-duotone"
            width={32}
          />
          <div className="space-y-1">
            <p className="text-base font-medium text-default-900">
              No Shopify store yet?
            </p>
            <p className="text-sm text-default-600">
              Preview the Meyoo dashboard using our demo workspace with sample data.
            </p>
          </div>
          <Button
            color="primary"
            radius="full"
            size="lg"
            startContent={
              <Icon
                aria-hidden="true"
                icon="solar:play-circle-bold-duotone"
                width={20}
              />
            }
            variant="shadow"
            onPress={handleOpenDemoModal}
          >
            Explore Demo Workspace
          </Button>
        </div>
      )}

      {/* Action Buttons */}
      <SimpleNavigationButtons
        isNextDisabled={!user?.hasShopifyConnection}
        nextLabel={
          user?.hasShopifyConnection ? "Continue" : "Connect Shopify"
        }
        showPrevious={false}
        onNext={user?.hasShopifyConnection ? async () => {
          trackOnboardingAction("shopify", "continue");
          router.push("/onboarding/billing");
          return true;
        } : undefined}
      />

      <Modal
        isDismissable={!joiningDemo}
        isOpen={isDemoModalOpen}
        className="bg-default-50"
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
              <ModalHeader className="flex gap-3 pb-2">
                <span className="rounded-lg bg-primary/10 p-2">
                  <Icon
                    aria-hidden="true"
                    className="text-primary"
                    icon="solar:planet-bold-duotone"
                    width={20}
                  />
                </span>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-default-900">
                    Explore Meyoo with demo data
                  </span>
                  <span className="text-xs text-default-500">
                    Join the Meyoo demo organization to try features risk-free.
                  </span>
                </div>
              </ModalHeader>
              <Divider />
              <ModalBody className="gap-4 py-6">
                {demoError && (
                  <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-3">
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 text-danger"
                      icon="solar:danger-triangle-bold"
                      width={18}
                    />
                    <p className="text-sm text-danger">{demoError}</p>
                  </div>
                )}

                <div className="space-y-3 text-sm text-default-500">
                  <p>
                    We will add you to the Meyoo demo organization so you can navigate the dashboard using live sample data.
                  </p>
                  <p>
                    Your current workspace stays untouched, and you can leave the demo later from team settings.
                  </p>
                </div>
              </ModalBody>
              <Divider />
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
                  startContent={
                    !joiningDemo ? (
                      <Icon
                        aria-hidden="true"
                        icon="solar:play-circle-bold-duotone"
                        width={18}
                      />
                    ) : undefined
                  }
                  onPress={handleJoinDemo}
                >
                  Join Demo Workspace
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
