import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  fetchAnalyticsSourceData,
  validateDateRange,
  type AnalyticsSourceData,
  type DateRange,
  type AnalyticsSourceKey,
} from "../utils/analyticsSource";

export const datasetValidator = v.object({
  orders: v.array(v.any()),
  orderItems: v.array(v.any()),
  transactions: v.array(v.any()),
  refunds: v.array(v.any()),
  fulfillments: v.array(v.any()),
  products: v.array(v.any()),
  variants: v.array(v.any()),
  customers: v.array(v.any()),
  metaInsights: v.array(v.any()),
  costs: v.array(v.any()),
  productCostComponents: v.array(v.any()),
  sessions: v.array(v.any()),
  analytics: v.array(v.any()),
});

export const responseValidator = v.object({
  dateRange: v.object({ startDate: v.string(), endDate: v.string() }),
  organizationId: v.string(),
  data: datasetValidator,
  meta: v.optional(v.any()),
});

export type AnalyticsResponse = {
  dateRange: DateRange;
  organizationId: string;
  data: AnalyticsSourceData;
  meta?: Record<string, unknown>;
};

export interface LoadAnalyticsOptions {
  datasets?: readonly AnalyticsSourceKey[];
}

export function defaultDateRange(daysBack = 30): DateRange {
  const now = new Date();
  const endDate = now.toISOString().substring(0, 10);
  const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().substring(0, 10);
  return { startDate, endDate };
}

export function normalizeDateRange(
  range?: { startDate?: string; endDate?: string; daysBack?: number },
  fallbackDays = 30,
): DateRange {
  if (range?.startDate && range?.endDate) {
    return validateDateRange({
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }

  const fallback = defaultDateRange(range?.daysBack ?? fallbackDays);

  if (range?.startDate) {
    fallback.startDate = range.startDate;
  }

  if (range?.endDate) {
    fallback.endDate = range.endDate;
  }

  return validateDateRange(fallback);
}

export async function loadAnalytics(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  range: DateRange,
  options?: LoadAnalyticsOptions,
): Promise<AnalyticsResponse> {
  const data = await fetchAnalyticsSourceData(ctx, organizationId, range, options);
  return { dateRange: range, organizationId, data };
}
