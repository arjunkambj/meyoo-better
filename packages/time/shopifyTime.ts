/**
 * Shopify timezone helpers
 *
 * Shopify GraphQL exposes timezoneAbbreviation and timezoneOffset/Minutes.
 * When IANA timezone isn't available, use the current UTC offset string/minutes
 * to compute shop-local day boundaries and ranges.
 */

/** Convert "+HH:MM" or "-HH:MM" to minutes. */
export function offsetStringToMinutes(offset: string): number {
  const m = /([+-])(\d{2}):(\d{2})/.exec(offset.trim());
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  return sign * (hours * 60 + minutes);
}

/** Convert minutes to "+HH:MM" or "-HH:MM". */
export function minutesToOffsetString(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const m = (abs % 60).toString().padStart(2, "0");
  return `${sign}${h}:${m}`;
}

/** Returns true if string looks like an IANA timezone identifier. */
export function isIanaTimeZone(tz?: string | null): boolean {
  if (!tz) return false;
  try {
    // Intl throws if invalid; also ensure it contains at least one '/'
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.includes("/");
  } catch {
    return false;
  }
}

/**
 * Get shop-local midnight for a given UTC instant using a fixed UTC offset (minutes).
 * Note: Uses a constant offset; does not handle historical DST transitions.
 */
export function shopMidnightUtc(dateUtc: Date, offsetMinutes: number): Date {
  // Convert the UTC instant to shop-local wall clock time by adding offset (in ms).
  const localMs = dateUtc.getTime() + offsetMinutes * 60_000;

  // Read the calendar date from the "virtual local" time using UTC getters to avoid
  // host timezone interference.
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  // Construct midnight at the shop-local date, then convert back to real UTC by subtracting offset.
  const localMidnightUtcMs = Date.UTC(y, m, d); // local midnight expressed in UTC ms baseline
  return new Date(localMidnightUtcMs - offsetMinutes * 60_000);
}

/** Get start and end UTC instants for the shop-local day containing the given UTC instant. */
export function shopDayBoundsUtc(dateUtc: Date, offsetMinutes: number): {
  startUtc: Date;
  endUtc: Date;
} {
  const startUtc = shopMidnightUtc(dateUtc, offsetMinutes);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { startUtc, endUtc };
}

/** Format a Date as YYYY-MM-DD in UTC. */
export function formatUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
