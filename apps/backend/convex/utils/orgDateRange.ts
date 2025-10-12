import { parseDate } from "@internationalized/date";

import { api, internal } from "../_generated/api";
import type { ActionCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toUtcRangeForOffset } from "@repo/time";
import { validateDateRange, type DateRange } from "./analyticsSource";
import { normalizeDateString } from "./date";

type RangeInput = {
  startDate: string;
  endDate: string;
  startDateTimeUtc?: string;
  endDateTimeUtc?: string;
  endDateTimeUtcExclusive?: string;
  dayCount?: number;
};

type ActionLikeCtx = Pick<ActionCtx, "runQuery" | "runAction">;
type QueryLikeCtx = Pick<QueryCtx, "runQuery">;
type RangeCtx = ActionLikeCtx | QueryLikeCtx;

function isActionContext(ctx: RangeCtx): ctx is ActionLikeCtx {
  return typeof (ctx as ActionLikeCtx).runAction === "function";
}

function buildRangeWithTimezone(
  startDate: string,
  endDate: string,
  timezone: string,
  organizationId: Id<"organizations">,
): DateRange | null {
  try {
    const startCalendar = parseDate(startDate);
    const endCalendar = parseDate(endDate).add({ days: 1 });

    const startUtc = startCalendar.toDate(timezone);
    const endExclusiveUtc = endCalendar.toDate(timezone);

    return validateDateRange({
      startDate,
      endDate,
      startDateTimeUtc: startUtc.toISOString(),
      endDateTimeUtc: new Date(endExclusiveUtc.getTime() - 1).toISOString(),
      endDateTimeUtcExclusive: endExclusiveUtc.toISOString(),
    });
  } catch (error) {
    console.warn("[DateRange] Failed to convert range using timezone", {
      organizationId,
      timezone,
      error,
    });
    return null;
  }
}

export async function resolveDateRangeForOrganization(
  ctx: RangeCtx,
  organizationId: Id<"organizations">,
  range: RangeInput,
): Promise<DateRange> {
  if (
    range.startDateTimeUtc ||
    range.endDateTimeUtc ||
    range.endDateTimeUtcExclusive
  ) {
    return validateDateRange(range);
  }

  const startDate = normalizeDateString(range.startDate);
  const endDate = normalizeDateString(range.endDate);

  let timezone: string | null = null;
  try {
    const tzResult = await ctx.runQuery(
      internal.core.organizations.getOrganizationTimezoneInternal,
      { organizationId },
    );
    timezone = tzResult?.timezone ?? null;
  } catch (error) {
    console.warn("[DateRange] Failed to load organization timezone", {
      organizationId,
      error,
    });
  }

  let offsetMinutes = 0;

  const rangeFromTimezone =
    timezone && buildRangeWithTimezone(startDate, endDate, timezone, organizationId);

  if (rangeFromTimezone) {
    return rangeFromTimezone;
  }

  if (isActionContext(ctx)) {
    try {
      const info = await ctx.runAction(api.core.time.getShopTimeInfo, {
        organizationId,
      });
      if (info?.timezoneIana) {
        const actionRange = buildRangeWithTimezone(
          startDate,
          endDate,
          info.timezoneIana,
          organizationId,
        );
        if (actionRange) {
          return actionRange;
        }
      }
      if (typeof info?.offsetMinutes === "number" && Number.isFinite(info.offsetMinutes)) {
        offsetMinutes = info.offsetMinutes;
      }
    } catch (error) {
      console.warn("[DateRange] Failed to resolve shop offset via action", {
        organizationId,
        error,
      });
    }
  }

  const fallbackRange = toUtcRangeForOffset(
    { startDate, endDate },
    offsetMinutes,
  );

  return validateDateRange({
    startDate,
    endDate,
    startDateTimeUtc: fallbackRange.startDateTimeUtc,
    endDateTimeUtc: fallbackRange.endDateTimeUtc,
    endDateTimeUtcExclusive: fallbackRange.endDateTimeUtcExclusive,
  });
}
