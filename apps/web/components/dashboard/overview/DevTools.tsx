"use client";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Input,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAction } from "convex/react";

import { useDevTools, useIntegrationStatus, useIsOnboarded, useUser } from "@/hooks";
import { api } from "@/libs/convexApi";

import { ConfirmationDialog } from "./ConfimationDialog";

export function DevTools() {
  const router = useRouter();
  const {
    resetEverything,
    disconnectShopify,
    disconnectMeta,
    isLoading: _globalLoading,
    error,
  } = useDevTools();

  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  const { user } = useUser();
  const { hasShopify, hasMeta } = useIntegrationStatus();
  const isOnboarded = useIsOnboarded();

  // Map to expected names for backward compatibility
  const hasShopifyConnection = hasShopify;
  const hasMetaConnection = hasMeta;

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: () => void;
    title: string;
    description: string;
  }>({
    isOpen: false,
    action: () => {},
    title: "",
    description: "",
  });

  // Recalculate analytics
  const { isOpen: recalcOpen, onOpen: openRecalc, onOpenChange: setRecalcOpen, onClose: closeRecalc } = useDisclosure();
  const [range, setRange] = useState<"all" | "60" | "30" | "custom">("60");
  const [customDays, setCustomDays] = useState<string>("");
  const recalc = useAction(api.meyoo.admin.recalculateAnalytics);
  const isRecalcLoading = !!isLoading["recalc-analytics"];
  const resolvedDaysBack = useMemo(() => {
    switch (range) {
      case "all":
        return 3650; // approx. 10 years as "all time"
      case "60":
        return 60;
      case "30":
        return 30;
      case "custom":
        return Math.max(1, Number.isFinite(Number(customDays)) ? Number(customDays) : 0);
      default:
        return 60;
    }
  }, [range, customDays]);

  const handleRecalcConfirm = async () => {
    setIsLoading((prev) => ({ ...prev, ["recalc-analytics"]: true }));
    setRecalcMessage(null);
    setRecalcError(null);
    try {
      const result = await recalc({ daysBack: resolvedDaysBack });
      setRecalcMessage(result?.message || "Analytics recalculated successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to recalculate analytics";
      setRecalcError(msg);
    } finally {
      setIsLoading((prev) => ({ ...prev, ["recalc-analytics"]: false }));
      closeRecalc();
    }
  };

  // Check if user is authenticated
  if (!user) {
    return (
      <div className="bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 p-6">
        <p className="text-sm text-default-500">
          Loading user authentication...
        </p>
      </div>
    );
  }

  const handleConfirm = (
    action: () => Promise<void>,
    title: string,
    description: string,
    loadingKey: string,
  ) => {
    setConfirmDialog({
      isOpen: true,
      action: async () => {
        setIsLoading((prev) => ({ ...prev, [loadingKey]: true }));
        try {
          await action();
        } finally {
          setIsLoading((prev) => ({ ...prev, [loadingKey]: false }));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
      title,
      description,
    });
  };

  return (
    <div className="bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Icon
              className="text-warning-500"
              icon="heroicons:wrench-screwdriver-20-solid"
              width={20}
            />
            Developer Tools
          </h3>
          <p className="text-sm text-default-500">
            Dangerous operations for development only
          </p>
        </div>
        <Chip color="warning" size="sm" variant="flat">
          Dev Only
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button
          className="justify-start"
          color="primary"
          isDisabled={!isOnboarded}
          isLoading={isLoading["recalc-analytics"]}
          size="lg"
          startContent={!isLoading["recalc-analytics"] && <Icon icon="heroicons:chart-bar-20-solid" width={20} />}
          variant="solid"
          onPress={() => {
            setRecalcMessage(null);
            setRecalcError(null);
            openRecalc();
          }}
        >
          Recalculate Analytics
        </Button>

        <Button
          className="justify-start"
          color="danger"
          isDisabled={!isOnboarded}
          isLoading={isLoading["reset-all"]}
          size="lg"
          startContent={
            !isLoading["reset-all"] && (
              <Icon icon="heroicons:arrow-path-20-solid" width={20} />
            )
          }
          variant="solid"
          onPress={() =>
            handleConfirm(
              async () => {
                await resetEverything();
                router.push("/onboarding");
              },
              "Reset Everything",
              "This will delete all organization data and restore a fresh state.",
              "reset-all",
            )
          }
        >
          Reset Everything
        </Button>

        <Button
          className="justify-start bg-emerald-600 text-white"
          isDisabled={!hasShopifyConnection}
          isLoading={isLoading["disconnect-shopify"]}
          size="lg"
          startContent={
            !isLoading["disconnect-shopify"] && (
              <Icon icon="simple-icons:shopify" width={20} />
            )
          }
          variant="solid"
          onPress={() =>
            handleConfirm(
              disconnectShopify,
              "Disconnect Shopify",
              "This will delete all Shopify data and connections",
              "disconnect-shopify",
            )
          }
        >
          {hasShopifyConnection
            ? "Disconnect Shopify"
            : "Shopify Not Connected"}
        </Button>

        <Button
          className="justify-start bg-blue-600 text-white"
          isDisabled={!hasMetaConnection}
          isLoading={isLoading["disconnect-meta"]}
          size="lg"
          startContent={
            !isLoading["disconnect-meta"] && (
              <Icon icon="streamline:meta-solid" width={20} />
            )
          }
          variant="solid"
          onPress={() =>
            handleConfirm(
              disconnectMeta,
              "Disconnect Meta",
              "This will delete all Meta data and connections",
              "disconnect-meta",
            )
          }
        >
          {hasMetaConnection ? "Disconnect Meta" : "Meta Not Connected"}
        </Button>

      </div>

      {/* Error display */}
      {error && <p className="text-xs text-danger mt-4">{error}</p>}
      {recalcError && <p className="text-xs text-danger mt-2">{recalcError}</p>}
      {recalcMessage && (
        <p className="text-xs text-success mt-2">{recalcMessage}</p>
      )}

      <ConfirmationDialog
        confirmText="Confirm"
        description={confirmDialog.description}
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        variant="danger"
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.action}
      />

      {/* Recalculate Analytics Modal */}
      <Modal isOpen={recalcOpen} onOpenChange={setRecalcOpen} placement="center" size="md">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Icon className="text-primary" icon="heroicons:chart-bar-square-20-solid" width={20} />
            Recalculate Analytics
          </ModalHeader>
          <ModalBody className="bg-default-50 gap-5">
            <p className="text-sm text-default-600">
              Choose a time range to re-aggregate analytics. This includes all costs and expenses.
            </p>
            <RadioGroup
              value={range}
              onValueChange={(val) => {
                const v = String(val);
                if (v === "all" || v === "60" || v === "30" || v === "custom") {
                  setRange(v);
                }
              }}
            >
              <Radio value="all">All time</Radio>
              <Radio value="60">Last 60 days</Radio>
              <Radio value="30">Last 30 days</Radio>
              <Radio value="custom">Custom (enter days)</Radio>
            </RadioGroup>
            {range === "custom" && (
              <div className="pt-1">
                <Input
                  isRequired
                  label="Days back"
                  labelPlacement="outside"
                  min={1}
                  placeholder="e.g. 90"
                  type="number"
                  value={customDays}
                  onValueChange={setCustomDays}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeRecalc}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={range === "custom" && (!customDays || Number(customDays) < 1)}
              isLoading={isRecalcLoading}
              onPress={handleRecalcConfirm}
            >
              Recalculate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
