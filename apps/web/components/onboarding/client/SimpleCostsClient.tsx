"use client";

import { Button, Card, CardBody, Input, Spinner, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  useCost,
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
    shopifySyncProgress,
    isShopifyProductsSynced,
    isShopifyInventorySynced,
    shopifyStageStatus,
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

  const formatStage = (stage?: string | null) =>
    stage ? stage.replace(/_/g, " ") : "pending";
  const costDataReady =
    (isShopifyProductsSynced ?? false) || (isShopifyInventorySynced ?? false);
  const productStageLabel = formatStage(shopifyStageStatus?.products);
  const inventoryStageLabel = formatStage(shopifyStageStatus?.inventory);
  const ordersStageLabel = formatStage(shopifyStageStatus?.orders);

  const [form, setForm] = useState({
    operatingCosts: "",
    shippingCost: "",
    // handling moved to product-level cost management
    paymentFeePercent: "",
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

  // Prefill only once when data loads to avoid infinite update loops
  const hasPrefilled = useRef(false);
  useEffect(() => {
    if (hasPrefilled.current) return;
    if (opLoading || shipLoading || payLoading) return;

    let anySet = false;
    setForm((prev) => {
      let next = prev;

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

      // Avoid triggering a re-render if nothing changed
      return anySet ? next : prev;
    });

    if (anySet) {
      hasPrefilled.current = true;
    }
  }, [
    opLoading,
    shipLoading,
    payLoading,
    operationalCosts,
    shippingCosts,
    paymentCosts,
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
      };
      trackOnboardingAction("cost", "save", {
        operatingCosts: payload.operatingCosts,
        shippingCost: payload.shippingCost,
        paymentFeePercent: payload.paymentFeePercent,
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
                  Shopify sync {hasShopifySyncError ? "needs attention" : "is still running"}
                </p>
                <p className="text-sm leading-relaxed">
                  {hasShopifySyncError
                    ? "We couldn\u2019t finish importing your Shopify data. Please return to the Shopify step to restart the sync before configuring costs."
                    : "We\u2019re still importing orders and products from Shopify. Once the import completes you can finish setting up costs."}
                </p>
                <p className="text-xs uppercase tracking-wide text-warning-500">
                  Products: {productStageLabel} • Inventory: {inventoryStageLabel} • Orders stage: {ordersStageLabel}
                  {typeof shopifySyncProgress.ordersProcessed === 'number' ?
                    (() => {
                      const seen = shopifySyncProgress.totalOrdersSeen as number | null;
                      const queued = shopifySyncProgress.ordersQueued as number | null;
                      const denom = typeof seen === 'number' ? seen : (queued && queued > 0 ? queued : undefined);
                      const suffix = denom !== undefined ? ` of ${denom}` : '';
                      return ` • Orders processed: ${shopifySyncProgress.ordersProcessed}${suffix}`;
                    })()
                    : (shopifySyncProgress.recordsProcessed ? ` • Records processed: ${shopifySyncProgress.recordsProcessed}` : '')}
                </p>
              </div>
            </div>
            {!hasShopifySyncError && (
              <div className="flex items-center justify-start gap-2 text-warning-500">
                <Spinner size="sm" color="warning" />
                <span className="text-xs">
                  We&apos;ll unlock this step automatically when the sync finishes.
                </span>
              </div>
            )}
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Icon
            className="text-primary"
            icon="solar:settings-minimalistic-bold-duotone"
          />
          <h1 className="text-xl lg:text-2xl font-bold text-default-900">
            Fees & Shipping
          </h1>
        </div>
        <p className="text-default-600 text-sm">
          Set global costs here. Product-specific costs (COGS, tax, handling)
          are configured in the next step. You can refine all costs later in Cost Management.
        </p>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        <Input
          className="md:w-120"
          label="Fixed Monthly Operating Cost"
          labelPlacement="outside"
          startContent={
            <span className="text-default-400 text-small">
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
        {/* Global Tax removed; set per product in Products step */}
        <Input
          className="md:w-120"
          label="Payment Gateway Fee %"
          labelPlacement="outside"
          endContent={<span className="text-default-400 text-small">%</span>}
          placeholder="e.g. 2"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={form.paymentFeePercent}
          onValueChange={onChange("paymentFeePercent")}
        />

        <Input
          className="mt-1 md:w-120"
          startContent={
            <span className="text-default-400 text-small">
              {currencySymbol}
            </span>
          }
          placeholder="e.g. 25"
          type="number"
          label="Average Shipping (per order)"
          labelPlacement="outside"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={form.shippingCost}
          onValueChange={onChange("shippingCost")}
        />

        {/* Handling removed from onboarding; set in Product Costs */}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          startContent={<Icon icon="solar:alt-arrow-left-linear" />}
          variant="light"
          isDisabled={saving}
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
        <div className="flex items-center gap-3">
          <Button
            color="primary"
            isLoading={saving}
            onPress={handleSave}
            endContent={<Icon icon="solar:alt-arrow-right-linear" />}
          >
            Save & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
