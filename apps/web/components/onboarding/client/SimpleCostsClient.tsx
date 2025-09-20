"use client";

import { Button, Input, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useCost, useOnboarding, useOnboardingCosts, useUpdateOnboardingState, useUser } from "@/hooks";
import { getCurrencySymbol } from "@/libs/utils/format";
import { trackOnboardingAction, trackOnboardingView } from "@/libs/analytics";
import { useSetAtom } from "jotai";
import { setNavigationPendingAtom } from "@/store/onboarding";

export default function SimpleCostsClient() {
  const router = useRouter();
  const { status } = useOnboarding();
  const { saveInitialCosts } = useOnboardingCosts();
  const updateOnboardingState = useUpdateOnboardingState();
  const { primaryCurrency } = useUser();
  const currencySymbol = useMemo(() => getCurrencySymbol(primaryCurrency), [primaryCurrency]);
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
  const {
    costs: operationalCosts,
    loading: opLoading,
  } = useCost("OPERATIONAL");
  const {
    costs: shippingCosts,
    loading: shipLoading,
  } = useCost("SHIPPING");
  const {
    costs: paymentCosts,
    loading: payLoading,
  } = useCost("PAYMENT");

  // Prefill only once when data loads to avoid infinite update loops
  const hasPrefilled = useRef(false);
  useEffect(() => {
    if (hasPrefilled.current) return;
    if (opLoading || shipLoading || payLoading) return;

    let anySet = false;
    setForm((prev) => {
      let next = prev;

      if (!prev.operatingCosts) {
        const op = (operationalCosts as CostRow[] | undefined || [])
          .filter((c) => c.frequency === "monthly" && !!c.isActive)
          .sort(
            (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
          )[0];
        if (op?.value !== undefined) {
          next = { ...next, operatingCosts: String(op.value) };
          anySet = true;
        }
      }

      if (!prev.shippingCost) {
        const ship = (shippingCosts as CostRow[] | undefined || [])
          .filter((c) => c.frequency === "per_order" && !!c.isActive)
          .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
        if (ship?.value !== undefined) {
          next = { ...next, shippingCost: String(ship.value) };
          anySet = true;
        }
      }

      if (!prev.paymentFeePercent) {
        const pay = (paymentCosts as CostRow[] | undefined || [])
          .filter((c) => c.calculation === "percentage" && !!c.isActive)
          .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
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
  }, [opLoading, shipLoading, payLoading, operationalCosts, shippingCosts, paymentCosts]);

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
        shippingMode: 'per_order' as const,
        // Handling fee removed from onboarding cost setup; configure per product instead
        paymentFeePercent: form.paymentFeePercent ? Number(form.paymentFeePercent) : 0,
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="text-primary" icon="solar:settings-minimalistic-bold-duotone" />
          <h1 className="text-xl lg:text-2xl font-bold text-default-900">Fees & Shipping</h1>
        </div>
        <p className="text-default-600 text-sm">
          Set fixed monthly operating cost and average shipping per order. You can refine later in Cost Management.
        </p>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 gap-4">
        <Input
          className="w-60 sm:w-72"
          label="Fixed Monthly Operating Cost"
          labelPlacement="outside"
          startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
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
          className="w-40 sm:w-48"
          label="Payment Gateway Fee %"
          labelPlacement="outside"
          endContent={<span className="text-default-400 text-small">%</span>}
          placeholder="2"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={form.paymentFeePercent}
          onValueChange={onChange("paymentFeePercent")}
        />
        <div className="rounded-medium border border-default-200 p-3">
          <div className="text-small text-default-500 mb-2">Average Shipping (per order)</div>
          <Input
            className="mt-1 w-56 sm:w-64"
            startContent={<span className="text-default-400 text-small">{currencySymbol}</span>}
            placeholder="e.g. 20"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.shippingCost}
            onValueChange={onChange("shippingCost")}
          />
        </div>

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
          <Button color="primary" isLoading={saving} onPress={handleSave} endContent={<Icon icon="solar:alt-arrow-right-linear" />}>
            Save & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
