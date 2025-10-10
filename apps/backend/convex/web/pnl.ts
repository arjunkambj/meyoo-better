import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { dateRangeValidator } from "./analyticsShared";
import { validateDateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadPnLAnalyticsFromDailyMetrics } from "../utils/dailyMetrics";
import type { PnLAnalyticsResult, PnLGranularity } from "@repo/types";

type DateRangeArg = { startDate: string; endDate: string };

function toIsoDate(date: Date): string {
  // Returns YYYY-MM-DD in UTC
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function parseIsoDate(dateStr: string): Date {
  // Interpret date-only as UTC midnight
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d;
}

function startOfWeekMonday(d: Date): Date {
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = base.getUTCDay() || 7; // 1..7 (Mon..Sun)
  if (day !== 1) {
    base.setUTCDate(base.getUTCDate() - day + 1);
  }
  return base;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function clampDateRangeForGranularity(
  range: DateRangeArg,
  granularity: PnLGranularity,
): DateRangeArg {
  // Clamp end date to today to avoid future dates
  const todayIso = new Date().toISOString().slice(0, 10);
  const endInput = parseIsoDate(range.endDate);
  const today = parseIsoDate(todayIso);
  const end = endInput.getTime() > today.getTime() ? today : endInput;
  const currentStart = parseIsoDate(range.startDate);

  if (granularity === "daily") {
    const minStart = new Date(end.getTime());
    // Always return exactly 8 days ending on end (inclusive)
    minStart.setUTCDate(minStart.getUTCDate() - 7);
    return { startDate: toIsoDate(minStart), endDate: toIsoDate(end) };
  }

  if (granularity === "weekly") {
    // Force exactly 8 full weeks ending with the week containing endDate
    const endWeekStart = startOfWeekMonday(end);
    const minWeekStart = new Date(endWeekStart.getTime());
    minWeekStart.setUTCDate(minWeekStart.getUTCDate() - 7 * 7); // 8 weeks => start is 7 weeks before end's week start
    return { startDate: toIsoDate(minWeekStart), endDate: toIsoDate(end) };
  }

  if (granularity === "monthly") {
    // Force a 3-month window ending with the month containing endDate
    const endMonthStart = startOfMonth(end);
    const minMonthStart = new Date(
      Date.UTC(endMonthStart.getUTCFullYear(), endMonthStart.getUTCMonth() - 2, 1),
    );
    return { startDate: toIsoDate(minMonthStart), endDate: toIsoDate(end) };
  }

  return { startDate: toIsoDate(currentStart), endDate: toIsoDate(end) };
}

export const getAnalytics = query({
  args: {
    dateRange: dateRangeValidator,
    granularity: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      dateRange: dateRangeValidator,
      organizationId: v.string(),
      result: v.optional(v.any()),
      meta: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    const granularity = (args.granularity ?? "daily") as PnLGranularity;
    const clamped = clampDateRangeForGranularity(args.dateRange, granularity);
    const range = validateDateRange(clamped);
    const organizationId = auth.orgId as Id<"organizations">;

    const dailyMetrics = await loadPnLAnalyticsFromDailyMetrics(
      ctx,
      organizationId,
      range,
      granularity
    );

    const meta: Record<string, unknown> = {
      strategy: "dailyMetrics",
      status: dailyMetrics.meta.hasData ? "ready" : "pending",
      ...dailyMetrics.meta,
    };

    return {
      dateRange: range,
      organizationId: auth.orgId as string,
      result: dailyMetrics.result,
      meta,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: PnLAnalyticsResult;
      meta: Record<string, unknown>;
    };
  },
});
