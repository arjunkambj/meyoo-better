"use client";

import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useDevTools, useIntegrationStatus, useIsOnboarded, useUser } from "@/hooks";

import { ConfirmationDialog } from "./ConfimationDialog";

export function DevTools() {
  const router = useRouter();
  const {
    resetEverything,
    disconnectShopify,
    disconnectMeta,
    isLoading: globalLoading,
    error,
  } = useDevTools();

  const [buttonLoading, setButtonLoading] = useState<Record<string, boolean>>({});

  const { user } = useUser();
  const { hasShopify, hasMeta } = useIntegrationStatus();
  const isOnboarded = useIsOnboarded();

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

  if (!user) {
    return (
      <div className="bg-content2 dark:bg-content1 rounded-2xl border border-default-200/50 p-6">
        <p className="text-sm text-default-500">Loading user authentication...</p>
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
      title,
      description,
      action: async () => {
        setButtonLoading((prev) => ({ ...prev, [loadingKey]: true }));
        try {
          await action();
        } finally {
          setButtonLoading((prev) => ({ ...prev, [loadingKey]: false }));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
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
          <p className="text-sm text-default-500">Dangerous operations for development only</p>
        </div>
        <Chip color="warning" size="sm" variant="flat">
          Dev Only
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button
          className="justify-start"
          color="danger"
          isDisabled={!isOnboarded}
          isLoading={buttonLoading["reset-all"]}
          size="lg"
          startContent={
            !buttonLoading["reset-all"] && <Icon icon="heroicons:arrow-path-20-solid" width={20} />
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
          isDisabled={!hasShopify}
          isLoading={buttonLoading["disconnect-shopify"]}
          size="lg"
          startContent={
            !buttonLoading["disconnect-shopify"] && (
              <Icon icon="simple-icons:shopify" width={20} />
            )
          }
          variant="solid"
          onPress={() =>
            handleConfirm(
              disconnectShopify,
              "Disconnect Shopify",
              "This will delete all Shopify data and connections.",
              "disconnect-shopify",
            )
          }
        >
          {hasShopify ? "Disconnect Shopify" : "Shopify Not Connected"}
        </Button>

        <Button
          className="justify-start bg-blue-600 text-white"
          isDisabled={!hasMeta}
          isLoading={buttonLoading["disconnect-meta"]}
          size="lg"
          startContent={
            !buttonLoading["disconnect-meta"] && (
              <Icon icon="streamline:meta-solid" width={20} />
            )
          }
          variant="solid"
          onPress={() =>
            handleConfirm(
              disconnectMeta,
              "Disconnect Meta",
              "This will delete all Meta data and connections.",
              "disconnect-meta",
            )
          }
        >
          {hasMeta ? "Disconnect Meta" : "Meta Not Connected"}
        </Button>
      </div>

      {error && <p className="text-xs text-danger mt-4">{error}</p>}
      {globalLoading && !Object.values(buttonLoading).some(Boolean) && (
        <p className="text-xs text-default-500 mt-2">Running requested operation…</p>
      )}

      <ConfirmationDialog
        confirmText="Confirm"
        description={confirmDialog.description}
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        variant="danger"
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.action}
      />
    </div>
  );
}
