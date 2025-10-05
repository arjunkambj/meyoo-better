import { parseDate } from "@internationalized/date";

import { internal } from "../_generated/api";
import type { ActionCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { toUtcRangeForOffset } from "@repo/time";
import { getShopUtcOffsetMinutes } from "../../libs/time/shopTime";
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

type RangeCtx = Pick<ActionCtx | QueryCtx, "runQuery">;

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

  if (timezone) {
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
    }
  }

  let offsetMinutes = 0;
  try {
    offsetMinutes = await getShopUtcOffsetMinutes(ctx as any, String(organizationId));
  } catch (error) {
    console.warn("[DateRange] Failed to resolve shop offset", {
      organizationId,
      error,
    });
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

