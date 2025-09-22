"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/libs/convexApi";
import { useOnboarding, useUpdateOnboardingState } from "@/hooks";
import { Card, CardBody, CardHeader, Button, RadioGroup, Radio, Spinner, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { formatDate } from "@/libs/utils/format";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

export default function AccountSelectionClient() {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPrimarySet, setHasPrimarySet] = useState(false);
  const { status } = useOnboarding();
  const updateOnboardingState = useUpdateOnboardingState();
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);

  // Fetch ad accounts
  const adAccounts = useQuery(api.integrations.meta.getAdAccounts);
  const setPrimaryAccount = useMutation(api.integrations.meta.setPrimaryAdAccount);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("accounts");
  }, []);

  // Minimal prerequisite guard: ensure Shopify + Billing before accounts
  useEffect(() => {
    if (!status) return;
    if (!status.connections?.shopify) {
      router.replace("/onboarding/shopify");
    } else if (!status.hasShopifySubscription) {
      router.replace("/onboarding/billing");
    }
  }, [status, router]);

  // Auto-select primary account if exists
  useEffect(() => {
    if (adAccounts && adAccounts.length > 0) {
      const primary = adAccounts.find((acc) => acc.isPrimary);
      if (primary) {
        setSelectedAccount(primary.accountId);
        setHasPrimarySet(true);
      } else if (!selectedAccount) {
        // Auto-select first account if no primary
        setSelectedAccount(adAccounts[0]?.accountId || "");
      }
    }
  }, [adAccounts, selectedAccount]);

  const handleContinue = async () => {
    // If already has primary set, just navigate
    if (hasPrimarySet) {
      trackOnboardingAction("accounts", "continue", { selected: selectedAccount });
      // Keep server step in sync (advance to step 5: products)
      await updateOnboardingState({ step: 5 });
      setNavigationPending(true);
      router.push("/onboarding/products");
      return;
    }

    if (!selectedAccount) {
      // No non-error toast per policy
      return;
    }

    setIsLoading(true);

    try {
      // Set the primary account
      await setPrimaryAccount({ accountId: selectedAccount });

      // Success toasts removed per onboarding policy

      // Navigate to products page (step 5)
      // Persist progression to Products so RouteGuard allows step 5
      await updateOnboardingState({ step: 5 });
      setNavigationPending(true);
      router.push("/onboarding/products");
    } catch (error) {
      console.error("Failed to set primary account:", error);
      addToast({
        title: "Failed to set account",
        description: "Please try again",
        color: "danger",
        timeout: 3000,
      });
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackOnboardingAction("accounts", "skip");
    // Skipping should still advance the flow
    updateOnboardingState({ step: 5 }).finally(() => {
      setNavigationPending(true);
      router.push("/onboarding/products");
    });
  };

  // Loading state
  if (!adAccounts) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-default-600">Loading ad accounts...</p>
        </CardBody>
      </Card>
    );
  }

  // No accounts state
  if (adAccounts.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Icon
            icon="solar:user-cross-bold-duotone"
            className="w-16 h-16 mx-auto mb-4 text-default-400"
          />
          <h3 className="text-lg font-semibold mb-2">No Ad Accounts Found</h3>
          <p className="text-default-600 mb-6">
            We couldn&apos;t find any ad accounts associated with your Meta connection.
            You can skip this step and continue.
          </p>
          <Button
            color="primary"
            onPress={handleSkip}
            endContent={<Icon icon="solar:arrow-right-line-duotone" width={18} />}
          >
            Continue to Products
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon
              icon="logos:meta-icon"
              className="w-6 h-6"
            />
            <h2 className="text-lg font-semibold">Meta Ad Accounts</h2>
          </div>
        </CardHeader>
        <CardBody>
          <RadioGroup
            label="Select your primary ad account"
            description={hasPrimarySet ? "Primary account has been set for this onboarding" : "This account will be used for main analytics and reporting"}
            value={selectedAccount}
            onValueChange={hasPrimarySet ? undefined : (v) => {
              setSelectedAccount(v);
              trackOnboardingAction("accounts", "select_account", { accountId: v });
            }}
            isDisabled={hasPrimarySet}
          >
            {adAccounts.map((account) => (
              <Radio
                key={account.accountId}
                value={account.accountId}
                description={
                  account.lastSyncAt
                    ? `Last synced: ${formatDate(account.lastSyncAt)}`
                    : "Not synced yet"
                }
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{account.accountName}</span>
                  {account.isPrimary && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Current Primary
                    </span>
                  )}
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="light"
          onPress={handleSkip}
          isDisabled={isLoading}
        >
          Skip this step
        </Button>
        <Button
          color="primary"
          onPress={hasPrimarySet ? () => router.push("/onboarding/products") : handleContinue}
          isLoading={isLoading && !hasPrimarySet}
          isDisabled={!selectedAccount && !hasPrimarySet}
          endContent={
            !isLoading && <Icon icon="solar:arrow-right-line-duotone" width={18} />
          }
        >
          {hasPrimarySet ? "Continue to Products" : isLoading ? "Saving..." : "Set Primary & Continue"}
        </Button>
      </div>
    </>
  );
}
