import { parseDate } from "@internationalized/date";
import { isIanaTimeZone, toUtcRangeForOffset } from "@repo/time";

type RangeYYYYMMDD = { startDate: string; endDate: string };
type AtomRange = { start: string; end: string };

// Deprecated: previously derived browser timezone. Prefer org timezone from backend.
export function getUserTimeZone(): string {
  return 'UTC';
}

/**
 * Convert a local calendar date range (YYYY-MM-DD) in a given timezone
 * into UTC date keys (YYYY-MM-DD) suitable for backend filtering where
 * data is stored by UTC day.
 *
 * Note: Given daily aggregates are UTC-based, edge days may include
 * partial-day overlap relative to the local timezone.
 */
export function toUtcRangeStrings(
  range: RangeYYYYMMDD,
  timeZone: string = 'UTC',
): RangeYYYYMMDD {
  const tz = isIanaTimeZone(timeZone) ? timeZone : 'UTC';
  // Start: local midnight -> UTC instant -> YYYY-MM-DD
  const startUtc = parseDate(range.startDate).toDate(tz);

  // End: local end-of-day -> convert by taking next local midnight - 1ms
  const endNextLocalMidnight = parseDate(range.endDate)
    .add({ days: 1 })
    .toDate(tz);
  const endUtc = new Date(endNextLocalMidnight.getTime() - 1);

  return {
    startDate: startUtc.toISOString().slice(0, 10),
    endDate: endUtc.toISOString().slice(0, 10),
  };
}

/**
 * Convert a range to UTC using a fixed shop UTC offset (minutes).
 * Prefer this when you want Shopify's timezone rather than the browser timezone.
 */
export function toUtcRangeForShopOffset(
  range: RangeYYYYMMDD,
  offsetMinutes: number,
): RangeYYYYMMDD {
  return toUtcRangeForOffset(range, offsetMinutes);
}

/**
 * Helper for ranges from the global atom { start, end }.
 */
export function atomRangeToUtc(
  range: AtomRange | null | undefined,
  timeZone: string = 'UTC',
): RangeYYYYMMDD | undefined {
  if (!range) return undefined;
  const tz = isIanaTimeZone(timeZone) ? timeZone : 'UTC';
  return toUtcRangeStrings(
    { startDate: range.start, endDate: range.end },
    tz,
  );
}

/**
 * Convert a date range to UTC day keys, preferring Shopify shop offset when provided.
 * Accepts either { start, end } or { startDate, endDate } shapes.
 */
export function dateRangeToUtcWithShopPreference(
  range:
    | { start: string; end: string }
    | { startDate: string; endDate: string },
  offsetMinutes?: number,
  timeZone: string = 'UTC',
): RangeYYYYMMDD {
  const tz = isIanaTimeZone(timeZone) ? timeZone : 'UTC';
  const r: RangeYYYYMMDD =
    'startDate' in range
      ? { startDate: range.startDate, endDate: range.endDate }
      : { startDate: range.start, endDate: range.end };

  if (typeof offsetMinutes === 'number') {
    return toUtcRangeForOffset(r, offsetMinutes);
  }
  return toUtcRangeStrings(r, tz);
}
