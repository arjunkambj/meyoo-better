export const ANALYTICS_DATASET_KEYS = [
  "orders",
  "orderItems",
  "transactions",
  "refunds",
  "fulfillments",
  "products",
  "variants",
  "customers",
  "metaInsights",
  "costs",
  "productCostComponents",
  "sessions",
  "analytics",
] as const;

export type AnalyticsDatasetKey = (typeof ANALYTICS_DATASET_KEYS)[number];

export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
}

export type AnalyticsSourceData<TRecord = unknown> = Record<
  AnalyticsDatasetKey,
  TRecord[]
>;

export interface AnalyticsSourceResponse<TRecord = unknown> {
  organizationId: string;
  dateRange: AnalyticsDateRange;
  data: AnalyticsSourceData<TRecord>;
}

export type AnalyticsDatasetCounts = Record<AnalyticsDatasetKey, number>;

export interface AnalyticsCalculationSummary {
  durationMs: number;
  datasetCounts: AnalyticsDatasetCounts;
}
