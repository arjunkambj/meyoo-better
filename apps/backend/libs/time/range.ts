import { daysBackUtcRangeForOffset, type RangeYYYYMMDD } from "@repo/time";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../../convex/_generated/dataModel";
import { getShopUtcOffsetMinutes } from "./shopTime";

/**
 * Compute a UTC date range (YYYY-MM-DD) for a shop's timezone, ending today,
 * spanning `daysBack` days.
 */
export async function shopDaysBackRange(
  ctx: GenericActionCtx<DataModel>,
  organizationId: string,
  daysBack: number,
): Promise<RangeYYYYMMDD> {
  const offset = await getShopUtcOffsetMinutes(ctx, organizationId);
  return daysBackUtcRangeForOffset(daysBack, offset);
}

