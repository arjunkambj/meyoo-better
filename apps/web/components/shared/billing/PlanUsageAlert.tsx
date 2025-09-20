"use client";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Progress } from "@heroui/progress";
import { Icon } from "@iconify/react";

import { useBilling, useOrganization } from "@/hooks";

interface PlanUsageAlertProps {
  showDetails?: boolean;
  variant?: "full" | "compact" | "minimal";
  onUpgradeClick?: () => void;
}

export function PlanUsageAlert({
  showDetails = true,
  variant = "full",
  onUpgradeClick,
}: PlanUsageAlertProps) {
  const { currentUsage, upgradeRecommendation, isLoading } = useBilling();
  const { organization } = useOrganization();

  // Don't show if no usage data or organization
  if (!currentUsage || !organization) return null;

  const { currentUsage: usage, limit, percentage, plan } = currentUsage;
  const planLabel = (() => {
    const map: Record<string, string> = {
      free: "Free Plan",
      starter: "Starter Plan",
      growth: "Growth Plan",
      business: "Business Plan",
    };
    return plan ? map[String(plan)] || String(plan) : "not selected";
  })();

  // Determine alert level based on usage
  const getAlertLevel = (percent: number) => {
    if (percent >= 95) return "critical";
    if (percent >= 80) return "warning";
    if (percent >= 60) return "info";

    return "none";
  };

  const alertLevel = getAlertLevel(percentage);

  // Don't show alert if usage is low
  if (alertLevel === "none") return null;

  const getAlertConfig = (level: string) => {
    switch (level) {
      case "critical":
        return {
          color: "danger" as const,
          bgColor: "bg-danger/10",
          borderColor: "border-danger/20",
          icon: "solar:danger-circle-bold",
          title: "Plan Limit Reached",
          actionText: "Upgrade Now",
        };
      case "warning":
        return {
          color: "warning" as const,
          bgColor: "bg-warning/10",
          borderColor: "border-warning/20",
          icon: "solar:danger-triangle-bold",
          title: "Approaching Plan Limit",
          actionText: "Upgrade Plan",
        };
      case "info":
        return {
          color: "primary" as const,
          bgColor: "bg-primary/10",
          borderColor: "border-primary/20",
          icon: "solar:info-circle-bold",
          title: "Plan Usage Update",
          actionText: "View Plans",
        };
      default:
        return {
          color: "default" as const,
          bgColor: "bg-default/10",
          borderColor: "border-default/20",
          icon: "solar:info-circle-linear",
          title: "Plan Usage",
          actionText: "View Plans",
        };
    }
  };

  const config = getAlertConfig(alertLevel);

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else if (upgradeRecommendation) {
      // Default upgrade behavior - could redirect to billing page
      console.log("Upgrading to:", upgradeRecommendation.planName);
    }
  };

  if (variant === "minimal") {
    return (
      <div
        className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3`}
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`text-${config.color} shrink-0`}
            icon={config.icon}
            width={16}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {usage.toLocaleString()}/{limit.toLocaleString()} orders (
              {Math.round(percentage)}%)
            </p>
          </div>
          {alertLevel === "critical" && (
            <Button
              color={config.color}
              isLoading={isLoading}
              size="sm"
              variant="flat"
              onPress={handleUpgrade}
            >
              {config.actionText}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <Card className={`${config.borderColor} border`}>
        <CardBody className="p-4">
          <div className="flex items-start gap-3">
            <Icon
              className={`text-${config.color} shrink-0`}
              icon={config.icon}
              width={20}
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {config.title}
                </p>
                <span className="text-xs text-default-500">
                  {Math.round(percentage)}% used
                </span>
              </div>

              <Progress
                classNames={{
                  base: "max-w-full",
                }}
                color={config.color}
                size="sm"
                value={percentage}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-default-600">
                  {usage.toLocaleString()} / {limit.toLocaleString()} orders
                </span>
                <Button
                  color={config.color}
                  isLoading={isLoading}
                  size="sm"
                  variant="flat"
                  onPress={handleUpgrade}
                >
                  {config.actionText}
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Full variant
  return (
    <Card className={`${config.borderColor} border`}>
      <CardBody className="p-6">
        <div className="flex items-start gap-4">
          <Icon
            className={`text-${config.color} shrink-0`}
            icon={config.icon}
            width={24}
          />
          <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-1">
                {config.title}
              </h4>
              <p className="text-sm text-default-600">
                You&apos;re using {usage.toLocaleString()} of {limit.toLocaleString()} orders ({Math.round(percentage)}%) on the {planLabel}.
                {upgradeRecommendation &&
                  ` Consider upgrading to ${upgradeRecommendation.planName.replace(" Plan", "")} 
                  for ${upgradeRecommendation.orderLimit.toLocaleString()} orders/month.`}
              </p>
            </div>

            {showDetails && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-default-600">Current usage</span>
                  <span className="font-medium text-foreground">
                    {usage.toLocaleString()} orders
                  </span>
                </div>

                <Progress
                  classNames={{
                    base: "max-w-full",
                    indicator: "bg-gradient-to-r",
                  }}
                  color={config.color}
                  size="md"
                  value={percentage}
                />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-default-600">Plan limit</span>
                  <span className="font-medium text-foreground">
                    {limit.toLocaleString()} orders
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                color={config.color}
                isLoading={isLoading}
                startContent={
                  !isLoading && <Icon icon="solar:crown-star-bold" width={16} />
                }
                variant="solid"
                onPress={handleUpgrade}
              >
                {config.actionText}
              </Button>

              {variant === "full" && (
                <Button
                  color="default"
                  variant="flat"
                  onPress={() => {
                    /* Navigate to billing page */
                  }}
                >
                  View Billing
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
