import { useMemo } from "react";

import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { OnboardingStatus } from "@repo/types";

type StageKey = "products" | "inventory" | "customers" | "orders";

export type SyncStageInfo = {
  key: StageKey;
  label: string;
  completed: boolean;
};

export type SyncCardState = "syncing" | "waiting" | "failed";

export interface InitialSyncCardData {
  platform: "shopify";
  state: SyncCardState;
  message: string;
  progress: null;
  stages: SyncStageInfo[];
  lastUpdated: number | null;
  error?: string | null;
  pendingPlatforms: string[];
}

const STAGE_LABELS: Record<StageKey, string> = {
  products: "Products",
  inventory: "Inventory",
  customers: "Customers",
  orders: "Orders",
};

const buildPreviewCard = (): InitialSyncCardData => ({
  platform: "shopify",
  state: "syncing",
  message: "Preview: Shopify sync in progress.",
  progress: null,
  stages: [
    { key: "products", label: STAGE_LABELS.products, completed: true },
    { key: "inventory", label: STAGE_LABELS.inventory, completed: true },
    { key: "customers", label: STAGE_LABELS.customers, completed: false },
    { key: "orders", label: STAGE_LABELS.orders, completed: false },
  ],
  lastUpdated: Date.now(),
  error: null,
  pendingPlatforms: ["shopify"],
});

const toStageEntries = (
  stages: {
    products: boolean;
    inventory: boolean;
    customers: boolean;
    orders: boolean;
  } | null | undefined,
): SyncStageInfo[] =>
  (Object.keys(STAGE_LABELS) as StageKey[]).map((key) => ({
    key,
    label: STAGE_LABELS[key],
    completed: Boolean(stages?.[key]),
  }));

export function useInitialSyncStatus() {
  const rawStatus = useQuery(api.core.onboarding.getOnboardingStatus);
  const status = rawStatus as OnboardingStatus | null | undefined;

  const isLoading = rawStatus === undefined;
  const debugForce =
    typeof window !== "undefined" &&
    window.location.search.includes("previewSyncCard");

  const data = useMemo<InitialSyncCardData | null>(() => {
    const previewCard = debugForce ? buildPreviewCard() : null;

    if (!status) {
      return previewCard;
    }

    const hasShopifyConnection = status.connections?.shopify ?? false;
    if (!hasShopifyConnection && !debugForce) {
      return null;
    }

    const shopify = status.syncStatus?.shopify;
    const overall = shopify?.overallState ?? null;
    const isInitialSyncComplete = status.isInitialSyncComplete ?? false;

    if (!debugForce && (isInitialSyncComplete || overall === "complete")) {
      return null;
    }

    const normalizedState: SyncCardState = (() => {
      if (overall === "failed" || shopify?.status === "failed") {
        return "failed";
      }
      if (
        overall === "syncing" ||
        shopify?.status === "processing" ||
        shopify?.status === "syncing" ||
        shopify?.status === "pending"
      ) {
        return "syncing";
      }
      if (!shopify) {
        return debugForce ? "syncing" : "waiting";
      }
      return "waiting";
    })();

    const lastUpdated =
      (typeof status.lastSyncCheckAt === "number" ? status.lastSyncCheckAt : null) ??
      (typeof shopify?.completedAt === "number" ? shopify.completedAt : null) ??
      (typeof shopify?.startedAt === "number" ? shopify.startedAt : null) ??
      (debugForce ? Date.now() : null);

    const message = (() => {
      if (normalizedState === "failed") {
        return "Initial Shopify sync needs attention. Review the error and retry the sync.";
      }
      if (normalizedState === "syncing") {
        return debugForce
          ? "Preview: Shopify sync in progress."
          : "We're syncing your Shopify data. Feel free to explore the dashboard while this finishes.";
      }
      return "Shopify sync is queued and should start momentarily.";
    })();

    const error = shopify?.lastError || null;
    const pendingPlatforms = status.pendingSyncPlatforms ?? [];

    const result: InitialSyncCardData = {
      platform: "shopify",
      state: normalizedState,
      message,
      progress: null,
      stages: toStageEntries(shopify?.stages ?? null),
      lastUpdated,
      error,
      pendingPlatforms,
    };

    if (debugForce && previewCard) {
      return {
        ...previewCard,
        ...result,
        state: result.state === "waiting" ? "syncing" : result.state,
        stages:
          result.stages.length > 0 ? result.stages : previewCard.stages,
        lastUpdated: result.lastUpdated ?? previewCard.lastUpdated,
        pendingPlatforms:
          result.pendingPlatforms.length > 0
            ? result.pendingPlatforms
            : previewCard.pendingPlatforms,
      };
    }

    return result;
  }, [status, debugForce]);

  const shouldDisplay = Boolean(data);

  return {
    isLoading,
    shouldDisplay,
    data,
  };
}
