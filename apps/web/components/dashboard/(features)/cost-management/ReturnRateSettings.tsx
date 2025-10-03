"use client";

import { Button, Card, CardBody, Input, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { useManualReturnRate, useSetManualReturnRate } from "@/hooks";
import { formatDistanceToNow } from "date-fns";

const sanitizePercentage = (value: string) => {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (cleaned === ".") return "0.";
  const parts = cleaned.split(".");
  const head = parts.shift() || "";
  const decimals = parts.join("");
  return decimals.length > 0 ? `${head}.${decimals}` : head;
};

export default function ReturnRateSettings() {
  const { manualReturnRate, loading } = useManualReturnRate();
  const setManualReturnRate = useSetManualReturnRate();

  const [rateInput, setRateInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!manualReturnRate) {
      setRateInput("");
      return;
    }

    if (manualReturnRate.isActive && typeof manualReturnRate.ratePercent === "number") {
      setRateInput(String(manualReturnRate.ratePercent));
    } else {
      setRateInput("");
    }
  }, [manualReturnRate, loading]);

  const parsedRate = useMemo(() => {
    if (rateInput.trim() === "") return undefined;
    const numeric = Number(rateInput);
    if (Number.isNaN(numeric)) return undefined;
    return Math.max(0, Math.min(100, numeric));
  }, [rateInput]);

  const hasInvalidInput = rateInput.trim() !== "" && parsedRate === undefined;

  const saveDisabled = saving || hasInvalidInput;

  const lastUpdatedLabel = useMemo(() => {
    if (!manualReturnRate?.updatedAt) return null;
    try {
      return formatDistanceToNow(new Date(manualReturnRate.updatedAt), { addSuffix: true });
    } catch (_error) {
      return null;
    }
  }, [manualReturnRate?.updatedAt]);

  const handleSave = async () => {
    if (saveDisabled) return;
    setSaving(true);
    try {
      await setManualReturnRate({ ratePercent: parsedRate });
      addToast({ title: "Return rate updated", color: "success", timeout: 2400 });
    } catch (_error) {
      addToast({ title: "Failed to update", color: "danger", timeout: 2600 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl border border-default-200/70 bg-content1/60 backdrop-blur">
      <CardBody className="space-y-6">
        <div className="flex items-start gap-3">
          <Icon
            icon="solar:refresh-circle-bold-duotone"
            className="text-primary"
            width={28}
          />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-default-900">RTO & Return Rate Override</h2>
            <p className="text-sm text-default-600">
              Use this percentage to estimate revenue lost to undetected returns/RTO. Leave the
              field empty to disable the manual adjustment.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:max-w-md">
          <Input
            label="Manual return rate"
            labelPlacement="outside"
            placeholder="e.g. 5"
            description="Only set this if Shopify doesn’t capture returns/RTO automatically."
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            endContent={<span className="text-default-400 text-base font-medium">%</span>}
            value={rateInput}
            isInvalid={hasInvalidInput}
            errorMessage={hasInvalidInput ? "Enter a percentage between 0 and 100" : undefined}
            onValueChange={(value) => setRateInput(sanitizePercentage(value))}
          />
          {manualReturnRate && (
            <div className="text-sm text-default-500">
              {manualReturnRate.isActive ? (
                <span>
                  Active at <span className="font-medium">{manualReturnRate.ratePercent}%</span>
                </span>
              ) : (
                <span>Manual override is currently disabled.</span>
              )}
              {lastUpdatedLabel ? (
                <span className="ml-2 text-default-400">(Updated {lastUpdatedLabel})</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            color="primary"
            className="font-semibold"
            isLoading={saving}
            isDisabled={saveDisabled}
            onPress={handleSave}
          >
            Save Return Rate
          </Button>
          <span className="text-xs text-default-400">
            Leave empty and save to clear the manual override.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
