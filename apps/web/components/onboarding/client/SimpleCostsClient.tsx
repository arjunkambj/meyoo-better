"use client";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  useCost,
  useManualReturnRate,
  useOnboarding,
  useOnboardingCosts,
  useUpdateOnboardingState,
  useUser,
} from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

export default function SimpleCostsClient() {
  const router = useRouter();
  const {
    status,
    isShopifySyncing,
    hasShopifySyncError,
    isShopifyProductsSynced,
    isShopifyInventorySynced,
  } = useOnboarding();
  const { saveInitialCosts } = useOnboardingCosts();
  const updateOnboardingState = useUpdateOnboardingState();
  const { primaryCurrency } = useUser();
  const currencySymbol = useMemo(
    () => getCurrencySymbol(primaryCurrency),
    [primaryCurrency]
  );
  const setNavigationPending = useSetAtom(setNavigationPendingAtom);

  // Guard routing for shopify/billing
  useEffect(() => {
    if (!status) return;
    if (!status.connections?.shopify) {
      router.replace("/onboarding/shopify");
    } else if (!status.hasShopifySubscription) {
      router.replace("/onboarding/billing");
    }
  }, [status, router]);

  const costDataReady =
    (isShopifyProductsSynced ?? false) || (isShopifyInventorySynced ?? false);
  const syncStateLabel = hasShopifySyncError
    ? "needs attention"
    : isShopifySyncing
      ? "syncing"
      : "queued";

  const [form, setForm] = useState({
    operatingCosts: "",
    shippingCost: "",
    // handling moved to product-level cost management
    paymentFeePercent: "",
    manualReturnRate: "",
  });
  const [saving, setSaving] = useState(false);

  // Prefill from existing costs so values persist when revisiting
  type CostRow = {
    frequency?: string;
    isActive?: boolean;
    updatedAt?: number;
    createdAt?: number;
    calculation?: string;
    value?: number;
  };
  const { costs: operationalCosts, loading: opLoading } =
    useCost("OPERATIONAL");
  const { costs: shippingCosts, loading: shipLoading } = useCost("SHIPPING");
  const { costs: paymentCosts, loading: payLoading } = useCost("PAYMENT");
  const { manualReturnRate: manualReturnRateData, loading: manualRateLoading } =
    useManualReturnRate();

  // Prefill only once when data loads to avoid infinite update loops
  const hasPrefilled = useRef(false);
  useEffect(() => {
    if (hasPrefilled.current) return;
    if (opLoading || shipLoading || payLoading || manualRateLoading) return;

    setForm((prev) => {
      let next = prev;
      let anySet = false;

      if (!prev.operatingCosts) {
        const op = ((operationalCosts as CostRow[] | undefined) || [])
          .filter((c) => c.frequency === "monthly" && !!c.isActive)
          .sort(
            (a, b) =>
              (b.updatedAt || b.createdAt || 0) -
              (a.updatedAt || a.createdAt || 0)
          )[0];
        if (op?.value !== undefined) {
          next = { ...next, operatingCosts: String(op.value) };
          anySet = true;
        }
      }

      if (!prev.shippingCost) {
        const ship = ((shippingCosts as CostRow[] | undefined) || [])
          .filter((c) => c.frequency === "per_order" && !!c.isActive)
          .sort(
            (a, b) =>
              (b.updatedAt || b.createdAt || 0) -
              (a.updatedAt || a.createdAt || 0)
          )[0];
        if (ship?.value !== undefined) {
          next = { ...next, shippingCost: String(ship.value) };
          anySet = true;
        }
      }

      if (!prev.paymentFeePercent) {
        const pay = ((paymentCosts as CostRow[] | undefined) || [])
          .filter((c) => c.calculation === "percentage" && !!c.isActive)
          .sort(
            (a, b) =>
              (b.updatedAt || b.createdAt || 0) -
              (a.updatedAt || a.createdAt || 0)
          )[0];
        if (pay?.value !== undefined) {
          next = { ...next, paymentFeePercent: String(pay.value) };
          anySet = true;
        }
      }

      if (
        !prev.manualReturnRate &&
        manualReturnRateData &&
        manualReturnRateData.isActive &&
        typeof manualReturnRateData.ratePercent === "number"
      ) {
        next = {
          ...next,
          manualReturnRate: String(manualReturnRateData.ratePercent ?? ""),
        };
        anySet = true;
      }

      // Mark as prefilled if any value was set
      if (anySet) {
        hasPrefilled.current = true;
      }

      // Avoid triggering a re-render if nothing changed
      return anySet ? next : prev;
    });
  }, [
    opLoading,
    shipLoading,
    payLoading,
    manualRateLoading,
    operationalCosts,
    shippingCosts,
    paymentCosts,
    manualReturnRateData,
  ]);

  // Analytics: step view
  useEffect(() => {
    trackOnboardingView("cost");
  }, []);

  // numeric-only helper
  const sanitizeDecimal = (val: string) => {
    if (val === undefined || val === null) return "";
    if (val === "") return "";
    const cleaned = String(val).replace(/[^0-9.]/g, "");
    if (cleaned === ".") return "0.";
    const parts = cleaned.split(".");
    const head = parts.shift() || "";
    const result = head + (parts.length > 0 ? "." + parts.join("") : "");
    return result;
  };

  const onChange = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: sanitizeDecimal(val) }));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        operatingCosts: form.operatingCosts ? Number(form.operatingCosts) : 0,
        shippingCost: form.shippingCost ? Number(form.shippingCost) : 0,
        // Handling fee removed from onboarding cost setup; configure per product instead
        paymentFeePercent: form.paymentFeePercent
          ? Number(form.paymentFeePercent)
          : 0,
        manualReturnRate:
          form.manualReturnRate !== ""
            ? Number(form.manualReturnRate)
            : undefined,
      };
      trackOnboardingAction("cost", "save", {
        operatingCosts: payload.operatingCosts,
        shippingCost: payload.shippingCost,
        paymentFeePercent: payload.paymentFeePercent,
        manualReturnRate: payload.manualReturnRate ?? null,
      });
      const result = await saveInitialCosts(payload);
      if (result?.success) {
        // Success toast removed per onboarding policy
        // Handling is configured per product in Cost Management
        // Advance server-side step to "complete" to satisfy guard
        await updateOnboardingState({ step: 7 });
        trackOnboardingAction("cost", "continue");
        router.push("/onboarding/complete");
      }
    } catch (_e) {
      addToast({ title: "Failed to save", color: "danger", timeout: 3500 });
    } finally {
      setSaving(false);
    }
  }, [form, saveInitialCosts, updateOnboardingState, router]);

  // Skip option removed to simplify UX

  if (!costDataReady) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
        <Card className="w-full border-warning bg-warning-50/40">
          <CardBody className="space-y-3 text-default-700">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-warning-500">
                <Icon icon="solar:refresh-circle-line-duotone" width={28} />
              </div>
              <div className="text-start space-y-1">
                <p className="font-semibold text-warning-600">
                  Shopify sync{" "}
                  {hasShopifySyncError ? "needs attention" : "is still running"}
                </p>
                <p className="text-sm leading-relaxed">
                  {hasShopifySyncError
                    ? "We couldn\u2019t finish importing your Shopify data. Please return to the Shopify step to restart the sync before configuring costs."
                    : "We\u2019re still importing orders and products from Shopify. Once the import completes you can finish setting up costs."}
                </p>
                <p className="text-xs uppercase tracking-wide text-warning-500">
                  Shopify sync status: {syncStateLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-start gap-2 text-warning-500">
              <Spinner size="sm" color="warning" />
              <span className="text-xs">
                {hasShopifySyncError
                  ? "Head back to the Shopify step to retry the sync."
                  : "We\u2019ll unlock this step automatically when the sync finishes."}
              </span>
            </div>
          </CardBody>
        </Card>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="flat"
            size="sm"
            color="primary"
            onPress={() => router.refresh()}
            isDisabled={isShopifySyncing}
          >
            Refresh status
          </Button>
          {hasShopifySyncError && (
            <Button
              variant="solid"
              size="sm"
              color="warning"
              onPress={() => router.push("/onboarding/shopify")}
            >
              Retry Shopify sync
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <Icon
            className="text-primary"
            icon="solar:settings-minimalistic-bold-duotone"
            width={28}
          />
          <h1 className="text-2xl lg:text-3xl font-bold text-default-900">
            Fees & Shipping
          </h1>
        </div>
        <p className="text-default-600 text-base">
          Set global costs here. Product-specific costs (COGS, tax, handling)
          are configured in the next step. You can refine all costs later in
          Cost Management.
        </p>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-8 mt-8">
        <Input
          className="max-w-md"
          size="lg"
          label="Fixed Monthly Operating Cost"
          labelPlacement="outside"
          description="Your monthly fixed expenses (rent, salaries, software, etc.)"
          startContent={
            <span className="text-default-400 text-base font-medium">
              {currencySymbol}
            </span>
          }
          placeholder="5000"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.operatingCosts}
          onValueChange={onChange("operatingCosts")}
        />

        <Input
          className="max-w-md"
          size="lg"
          label="Payment Gateway Fee %"
          labelPlacement="outside"
          description="Percentage fee charged by your payment processor"
          endContent={
            <span className="text-default-400 text-base font-medium">%</span>
          }
          placeholder="e.g. 2.9"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={form.paymentFeePercent}
          onValueChange={onChange("paymentFeePercent")}
        />

        <Input
          className="max-w-md"
          size="lg"
          label="Average Shipping Cost (per order)"
          labelPlacement="outside"
          description="Average shipping cost per order"
          startContent={
            <span className="text-default-400 text-base font-medium">
              {currencySymbol}
            </span>
          }
          placeholder="e.g. 25"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.shippingCost}
          onValueChange={onChange("shippingCost")}
        />

        <Input
          className="max-w-md"
          size="lg"
          label="Manual Return / RTO Rate (Average Monthly)"
          labelPlacement="outside"
          description="Only set this if Shopify doesn't capture returns/RTO. Leave blank to disable."
          endContent={
            <span className="text-default-400 text-base font-medium">%</span>
          }
          placeholder="e.g. 5"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.1"
          value={form.manualReturnRate}
          onValueChange={onChange("manualReturnRate")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-divider">
        <Button
          startContent={
            <Icon icon="solar:arrow-left-line-duotone" width={18} />
          }
          variant="flat"
          size="lg"
          isDisabled={saving}
          className="font-semibold"
          onPress={() => {
            setNavigationPending(true);
            try {
              router.back();
            } catch {
              setNavigationPending(false);
            }
          }}
        >
          Back
        </Button>
        <Button
          color="primary"
          size="lg"
          isLoading={saving}
          className="font-bold min-w-40"
          onPress={handleSave}
          endContent={
            !saving && <Icon icon="solar:arrow-right-line-duotone" width={20} />
          }
        >
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
