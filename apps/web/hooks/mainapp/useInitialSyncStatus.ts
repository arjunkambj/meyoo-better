import { useMemo } from "react";

import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

type StageKey = "products" | "inventory" | "customers" | "orders";
type StageStatusValue = string | undefined;

export type SyncStageInfo = {
  key: StageKey;
  label: string;
  status: StageStatusValue;
};

export type SyncCardState = "syncing" | "waiting" | "failed";

export interface InitialSyncCardData {
  platform: "shopify";
  state: SyncCardState;
  message: string;
  progress?: {
    processed: number;
    total: number;
    percent: number;
  } | null;
  stageStatus: SyncStageInfo[];
  stats: Array<{ label: string; value: number | null }>;
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

const toSafeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const buildPreviewCard = (): InitialSyncCardData => ({
  platform: "shopify",
  state: "syncing",
  message: "Preview: Shopify sync in progress.",
  progress: {
    processed: 456,
    total: 1456,
    percent: 31,
  },
  stageStatus: [
    { key: "products", label: STAGE_LABELS.products, status: "completed" },
    { key: "inventory", label: STAGE_LABELS.inventory, status: "completed" },
    { key: "customers", label: STAGE_LABELS.customers, status: "processing" },
    { key: "orders", label: STAGE_LABELS.orders, status: "pending" },
  ],
  stats: [
    { label: "Products", value: 312 },
    { label: "Customers", value: 200 },
    { label: "Orders", value: 456 },
    { label: "Queued", value: 1456 },
  ],
  lastUpdated: Date.now(),
  error: null,
  pendingPlatforms: ["shopify"],
});

export function useInitialSyncStatus() {
  const status = useQuery(api.core.onboarding.getOnboardingStatus);

  const isLoading = status === undefined;
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
    const shopifyOverallRaw = shopify?.overallState;
    const shopifyOverall =
      typeof shopifyOverallRaw === "string" ? shopifyOverallRaw : null;
    const shopifyOverallText = shopifyOverall ?? "";
    const isInitialSyncComplete = status.isInitialSyncComplete ?? false;

    if (!debugForce && (isInitialSyncComplete || shopifyOverallText === "complete")) {
      return null;
    }

    const normalizedState: SyncCardState = (() => {
      if (shopifyOverallText === "failed" || shopify?.status === "failed") {
        return "failed";
      }
      if (
        shopifyOverallText === "syncing" ||
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

    const rawProcessed = toSafeNumber(shopify?.ordersProcessed);
    const rawTotalQueued = toSafeNumber(shopify?.ordersQueued);
    const rawTotalSeen = toSafeNumber(shopify?.totalOrdersSeen);

    const totalOrders = rawTotalQueued ?? rawTotalSeen ?? null;
    const processedOrders = rawProcessed ?? null;

    const progress = (() => {
      if (
        processedOrders !== null &&
        totalOrders !== null &&
        totalOrders > 0
      ) {
        const percent = Math.min(
          100,
          Math.max(0, Math.round((processedOrders / totalOrders) * 100)),
        );
        return {
          processed: processedOrders,
          total: totalOrders,
          percent,
        };
      }
      return null;
    })();

    let stageStatusEntries: SyncStageInfo[] = (Object.keys(STAGE_LABELS) as StageKey[])
      .map((key) => ({
        key,
        label: STAGE_LABELS[key],
        status: (shopify?.stageStatus as Record<string, string> | undefined)?.[key],
      }))
      .filter((stage) => stage.status !== undefined);

    if (stageStatusEntries.length === 0 && debugForce && previewCard) {
      stageStatusEntries = previewCard.stageStatus;
    }

    let stats: Array<{ label: string; value: number | null }> = [
      { label: "Products", value: toSafeNumber(shopify?.productsProcessed) },
      { label: "Customers", value: toSafeNumber(shopify?.customersProcessed) },
      { label: "Orders", value: processedOrders },
      { label: "Queued", value: totalOrders },
    ];

    if (stats.every((stat) => stat.value === null) && debugForce && previewCard) {
      stats = previewCard.stats;
    }

    const lastUpdated =
      toSafeNumber(status.lastSyncCheckAt) ??
      toSafeNumber(shopify?.completedAt) ??
      toSafeNumber(shopify?.startedAt) ??
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
      progress,
      stageStatus: stageStatusEntries,
      stats,
      lastUpdated,
      error,
      pendingPlatforms,
    };

    if (debugForce && previewCard) {
      return {
        ...previewCard,
        ...result,
        state: result.state === "waiting" ? "syncing" : result.state,
        progress: result.progress ?? previewCard.progress,
        stageStatus:
          result.stageStatus.length > 0 ? result.stageStatus : previewCard.stageStatus,
        stats: result.stats.some((stat) => stat.value !== null)
          ? result.stats
          : previewCard.stats,
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
