import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { dateRangeValidator } from "./analyticsShared";
import { validateDateRange } from "../utils/analyticsSource";
import { getUserAndOrg } from "../utils/auth";
import { loadPnLAnalyticsFromDailyMetrics } from "../utils/dailyMetrics";
import type { PnLAnalyticsResult, PnLGranularity } from "@repo/types";

type DateRangeArg = {
  startDate: string;
  endDate: string;
  startDateTimeUtc?: string;
  endDateTimeUtc?: string;
  endDateTimeUtcExclusive?: string;
};

function toIsoDate(date: Date): string {
  // Returns YYYY-MM-DD in UTC
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

function parseIsoDate(dateStr: string): Date {
  // Interpret date-only as UTC midnight
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d;
}

function deriveShopOffsetMs(range: DateRangeArg): number {
  const referenceStart = parseIsoDate(range.startDate).getTime();

  if (range.startDateTimeUtc) {
    const actualStart = Date.parse(range.startDateTimeUtc);
    if (Number.isFinite(actualStart)) {
      return referenceStart - actualStart;
    }
  }

  if (range.endDateTimeUtcExclusive) {
    const localExclusive = parseIsoDate(range.endDate);
    localExclusive.setUTCDate(localExclusive.getUTCDate() + 1);
    const actualExclusive = Date.parse(range.endDateTimeUtcExclusive);
    if (Number.isFinite(actualExclusive)) {
      return localExclusive.getTime() - actualExclusive;
    }
  }

  if (range.endDateTimeUtc) {
    const localInclusive = parseIsoDate(range.endDate);
    localInclusive.setUTCDate(localInclusive.getUTCDate() + 1);
    const actualInclusive = Date.parse(range.endDateTimeUtc);
    if (Number.isFinite(actualInclusive)) {
      return localInclusive.getTime() - (actualInclusive + 1);
    }
  }

  return 0;
}

function startOfWeekMonday(d: Date): Date {
  const base = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = base.getUTCDay() || 7; // 1..7 (Mon..Sun)
  if (day !== 1) {
    base.setUTCDate(base.getUTCDate() - day + 1);
  }
  return base;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function toUtcMidnight(date: Date, offsetMs: number): Date {
  return new Date(date.getTime() - offsetMs);
}

function clampDateRangeForGranularity(
  range: DateRangeArg,
  granularity: PnLGranularity,
): DateRangeArg {
  const offsetMs = deriveShopOffsetMs(range);
  const todayIso =
    offsetMs === 0
      ? new Date().toISOString().slice(0, 10)
      : toIsoDate(new Date(Date.now() + offsetMs));

  const endInput = parseIsoDate(range.endDate);
  const today = parseIsoDate(todayIso);
  const end = endInput.getTime() > today.getTime() ? today : endInput;
  const providedStart = parseIsoDate(range.startDate);
  const currentStart =
    providedStart.getTime() > end.getTime() ? end : providedStart;

  let normalizedStart = currentStart;

  if (granularity === "weekly") {
    const aligned = startOfWeekMonday(currentStart);
    normalizedStart =
      aligned.getTime() > end.getTime() ? startOfWeekMonday(end) : aligned;
  } else if (granularity === "monthly") {
    const aligned = startOfMonth(currentStart);
    normalizedStart =
      aligned.getTime() > end.getTime() ? startOfMonth(end) : aligned;
  }

  const normalizedStartDate = toIsoDate(normalizedStart);
  const normalizedEndDate = toIsoDate(end);

  const startUtc = toUtcMidnight(parseIsoDate(normalizedStartDate), offsetMs);
  const endExclusiveUtc = toUtcMidnight(
    parseIsoDate(normalizedEndDate),
    offsetMs,
  );
  endExclusiveUtc.setUTCDate(endExclusiveUtc.getUTCDate() + 1);

  return {
    ...range,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    startDateTimeUtc: startUtc.toISOString(),
    endDateTimeUtc: new Date(endExclusiveUtc.getTime() - 1).toISOString(),
    endDateTimeUtcExclusive: endExclusiveUtc.toISOString(),
  };
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
    const organization = await ctx.db.get(organizationId);
    const primaryCurrency =
      (organization && typeof organization.primaryCurrency === "string"
        ? organization.primaryCurrency
        : null) ?? "USD";

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
      primaryCurrency,
    };

    return {
      dateRange: range,
      organizationId: auth.orgId as string,
      result: {
        ...dailyMetrics.result,
        primaryCurrency,
      } satisfies PnLAnalyticsResult,
      meta,
    } satisfies {
      dateRange: { startDate: string; endDate: string };
      organizationId: string;
      result: PnLAnalyticsResult;
      meta: Record<string, unknown>;
    };
  },
});
