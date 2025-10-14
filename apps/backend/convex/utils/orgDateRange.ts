import { parseDate } from "@internationalized/date";

import { api, internal } from "../_generated/api";
import type { ActionCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isIanaTimeZone, toUtcRangeForOffset } from "@repo/time";
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

export type OrgTimeInfo = {
  timeZone: string | null;
  offsetMinutes: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

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

function formatDateInTimeZone(date: Date, timeZone: string): string {
  let formatter = ISO_FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    ISO_FORMATTER_CACHE.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(date);
  let year = "0000";
  let month = "00";
  let day = "00";

  for (const part of parts) {
    if (part.type === "year") year = part.value;
    if (part.type === "month") month = part.value;
    if (part.type === "day") day = part.value;
  }

  return `${year}-${month}-${day}`;
}

function formatDateFromShiftedMs(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getOrgTimeInfo(
  ctx: RangeCtx,
  organizationId: Id<"organizations">,
): Promise<OrgTimeInfo> {
  let timeZone: string | null = null;
  let offsetMinutes: number | null = null;

  try {
    const tzResult = await ctx.runQuery(
      internal.core.organizations.getOrganizationTimezoneInternal,
      { organizationId },
    );
    timeZone = tzResult?.timezone ?? null;
  } catch (error) {
    console.warn("[DateRange] Failed to load organization timezone", {
      organizationId,
      error,
    });
  }

  if (!timeZone && isActionContext(ctx)) {
    try {
      const info = await ctx.runAction(api.core.time.getShopTimeInfo, {
        organizationId,
      });
      if (info?.timezoneIana) {
        timeZone = info.timezoneIana;
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

  return {
    timeZone,
    offsetMinutes,
  };
}

function computeDefaultDateStrings(
  info: OrgTimeInfo,
  daysBack: number,
): { startDate: string; endDate: string } {
  const clampedDays = Math.max(0, Math.floor(daysBack));
  const now = Date.now();
  const rangeMs = clampedDays * DAY_MS;

  const timeZone = info.timeZone;

  if (timeZone && isIanaTimeZone(timeZone)) {
    try {
      const endDate = formatDateInTimeZone(new Date(now), timeZone);
      const startDate = formatDateInTimeZone(new Date(now - rangeMs), timeZone);
      return { startDate, endDate };
    } catch (error) {
      if (error instanceof RangeError) {
        console.warn("[DateRange] Falling back to offset for invalid timezone", {
          timeZone,
          error,
        });
      } else {
        throw error;
      }
    }
  }

  const offset = typeof info.offsetMinutes === "number" ? info.offsetMinutes : 0;
  const endLocalMs = now + offset * 60_000;
  const startLocalMs = endLocalMs - rangeMs;

  return {
    startDate: formatDateFromShiftedMs(startLocalMs),
    endDate: formatDateFromShiftedMs(endLocalMs),
  };
}

export async function resolveDateRangeForOrganization(
  ctx: RangeCtx,
  organizationId: Id<"organizations">,
  range: RangeInput,
  timeContext?: OrgTimeInfo,
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

  let timezone: string | null = timeContext?.timeZone ?? null;
  let offsetMinutes: number | null =
    typeof timeContext?.offsetMinutes === "number" ? timeContext.offsetMinutes : null;

  if (!timezone) {
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
  }

  const rangeFromTimezone =
    timezone && buildRangeWithTimezone(startDate, endDate, timezone, organizationId);

  if (rangeFromTimezone) {
    return rangeFromTimezone;
  }

  if (offsetMinutes == null && isActionContext(ctx)) {
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
        timezone = info.timezoneIana ?? null;
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

  const minutes = offsetMinutes ?? 0;
  const fallbackRange = toUtcRangeForOffset(
    { startDate, endDate },
    minutes,
  );

  return validateDateRange({
    startDate,
    endDate,
    startDateTimeUtc: fallbackRange.startDateTimeUtc,
    endDateTimeUtc: fallbackRange.endDateTimeUtc,
    endDateTimeUtcExclusive: fallbackRange.endDateTimeUtcExclusive,
  });
}

export async function defaultOrgDateRange(
  ctx: RangeCtx,
  organizationId: Id<"organizations">,
  daysBack = 30,
): Promise<DateRange> {
  const info = await getOrgTimeInfo(ctx, organizationId);
  const { startDate, endDate } = computeDefaultDateStrings(info, daysBack);
  return resolveDateRangeForOrganization(ctx, organizationId, { startDate, endDate }, info);
}

export async function resolveDateRangeOrDefault(
  ctx: RangeCtx,
  organizationId: Id<"organizations">,
  range: Partial<RangeInput> | null | undefined,
  fallbackDays = 30,
): Promise<DateRange> {
  if (!range) {
    return defaultOrgDateRange(ctx, organizationId, fallbackDays);
  }

  const hasStart = typeof range.startDate === "string" && range.startDate.length > 0;
  const hasEnd = typeof range.endDate === "string" && range.endDate.length > 0;

  if (hasStart && hasEnd) {
    return resolveDateRangeForOrganization(ctx, organizationId, range as RangeInput);
  }

  if (!hasStart && !hasEnd) {
    return defaultOrgDateRange(ctx, organizationId, fallbackDays);
  }

  const timeInfo = await getOrgTimeInfo(ctx, organizationId);
  const normalizedStart = hasStart ? normalizeDateString(range.startDate as string) : null;
  const normalizedEnd = hasEnd ? normalizeDateString(range.endDate as string) : null;

  let startDate: string;
  let endDate: string;

  if (normalizedStart && !normalizedEnd) {
    const { endDate: today } = computeDefaultDateStrings(timeInfo, 0);
    startDate = normalizedStart;
    endDate = today;
  } else if (!normalizedStart && normalizedEnd) {
    const clampedDays = Math.max(1, Math.floor(fallbackDays));
    const endCalendar = parseDate(normalizedEnd);
    const startCalendar = endCalendar.subtract({ days: clampedDays - 1 });
    startDate = startCalendar.toString();
    endDate = normalizedEnd;
  } else {
    const defaults = computeDefaultDateStrings(timeInfo, fallbackDays);
    startDate = normalizedStart ?? defaults.startDate;
    endDate = normalizedEnd ?? defaults.endDate;
  }

  return resolveDateRangeForOrganization(
    ctx,
    organizationId,
    {
      startDate,
      endDate,
    },
    timeInfo,
  );
}
