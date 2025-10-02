"use client";

import { Button, type ButtonProps } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

import { type Feature, useFeatureAccess } from "@/hooks";

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  disabled?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  disabled = false,
}: FeatureGateProps) {
  const { hasAccess, reason, upgradeRequired, currentPlan, requiredPlan } =
    useFeatureAccess(feature);
  const upgradeLoading = false;

  // If disabled, show the disabled state
  if (disabled) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
          <Card className="border-warning/20 bg-warning/10">
            <CardBody className="p-4 text-center">
              <Icon
                className="text-warning mx-auto mb-2"
                icon="solar:info-circle-bold"
                width={24}
              />
              <p className="text-sm font-medium text-foreground">
                Feature temporarily disabled
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt if access denied and upgrade required
  if (!hasAccess && upgradeRequired && showUpgradePrompt) {
    return (
      <Card className="border-warning/20">
        <CardBody className="p-6">
          <div className="flex items-start gap-4">
            <Icon
              className="text-warning shrink-0"
              icon="solar:crown-star-bold"
              width={24}
            />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-lg font-semibold text-foreground mb-1">
                  Upgrade Required
                </h4>
                <p className="text-sm text-default-600">{reason}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  color="warning"
                  isLoading={upgradeLoading}
                  startContent={
                    upgradeLoading ? null : (
                      <Icon icon="solar:crown-star-bold" width={16} />
                    )
                  }
                  variant="solid"
                  onPress={() => {
                    // Handle upgrade - could redirect to billing page
                    console.log(
                      `Upgrading from ${currentPlan} to ${requiredPlan}`,
                    );
                  }}
                >
                  Upgrade to {requiredPlan}
                </Button>

                <Button
                  color="default"
                  variant="flat"
                  onPress={() => {
                    // Navigate to billing page
                    window.location.href = "/settings/billing-invoices";
                  }}
                >
                  View Plans
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Fallback: show a simple disabled state
  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/30 rounded-lg">
        <Card className="border-default/20 bg-default/10">
          <CardBody className="p-4 text-center">
            <Icon
              className="text-default-400 mx-auto mb-2"
              icon="solar:lock-bold"
              width={24}
            />
            <p className="text-sm font-medium text-foreground">
              Feature not available
            </p>
            {reason && (
              <p className="text-xs text-default-500 mt-1">{reason}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/**
 * Higher-order component version for wrapping components
 */
export function withFeatureGate<P extends object>(
  Component: React.ComponentType<P>,
  feature: Feature,
  options?: {
    fallback?: ReactNode;
    showUpgradePrompt?: boolean;
  },
) {
  return function FeatureGatedComponent(props: P) {
    return (
      <FeatureGate
        fallback={options?.fallback}
        feature={feature}
        showUpgradePrompt={options?.showUpgradePrompt}
      >
        <Component {...props} />
      </FeatureGate>
    );
  };
}

/**
 * Utility component for simple button feature gating
 */
interface FeatureGatedButtonProps extends ButtonProps {
  feature: Feature;
  children: ReactNode;
  onUpgrade?: () => void;
}

export function FeatureGatedButton({
  feature,
  children,
  onUpgrade,
  ...buttonProps
}: FeatureGatedButtonProps) {
  const { hasAccess, reason, upgradeRequired } = useFeatureAccess(feature);

  if (!hasAccess && upgradeRequired) {
    return (
      <Button
        {...buttonProps}
        color="warning"
        startContent={<Icon icon="solar:crown-star-bold" width={16} />}
        variant="flat"
        onPress={
          onUpgrade ||
          (() => {
            // Default upgrade action
            window.location.href = "/settings/billing-invoices";
          })
        }
      >
        Upgrade Required
      </Button>
    );
  }

  return (
    <Button
      {...buttonProps}
      disabled={!hasAccess || buttonProps.disabled}
      title={!hasAccess ? reason : buttonProps.title}
    >
      {children}
    </Button>
  );
}
