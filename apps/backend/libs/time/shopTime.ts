import { offsetStringToMinutes } from "@repo/time";
import { ShopifyGraphQLClient } from "../shopify/ShopifyGraphQLClient";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../../convex/_generated/dataModel";
import { internal } from "../../convex/_generated/api";

/**
 * Resolve the active Shopify store for an organization.
 */
async function getActiveShopForOrg(
  ctx: GenericActionCtx<DataModel>,
  organizationId: string,
) {
  const store = await ctx.runQuery(
    internal.integrations.shopify.getActiveStoreInternal,
    { organizationId },
  );
  return store || null;
}

export async function getShopTimeInfo(
  ctx: GenericActionCtx<DataModel>,
  organizationId: string,
): Promise<{ offsetMinutes: number; timezoneAbbreviation?: string }> {
  const store = await getActiveShopForOrg(ctx, organizationId);
  if (!store) return { offsetMinutes: 0 };
  try {
    const client = new ShopifyGraphQLClient({
      shopDomain: store.shopDomain,
      accessToken: store.accessToken,
    });
    type ShopInfoResp = {
      data?: { shop?: { timezoneOffsetMinutes?: number; timezoneAbbreviation?: string; timezoneOffset?: string } };
      shop?: { timezoneOffsetMinutes?: number; timezoneAbbreviation?: string; timezoneOffset?: string };
    };
    const res = (await client.getShopInfo()) as unknown as ShopInfoResp;
    const shop = res.data?.shop ?? res.shop;
    const tzMinutes: number | undefined = shop?.timezoneOffsetMinutes;
    const tzAbbr: string | undefined = shop?.timezoneAbbreviation;
    if (typeof tzMinutes === "number") return { offsetMinutes: tzMinutes, timezoneAbbreviation: tzAbbr };
    const tzOffsetStr: string | undefined = shop?.timezoneOffset;
    if (typeof tzOffsetStr === "string") {
      return { offsetMinutes: offsetStringToMinutes(tzOffsetStr), timezoneAbbreviation: tzAbbr };
    }
  } catch {
    // ignore
  }
  return { offsetMinutes: 0 };
}

/**
 * Fetch the current Shopify UTC offset (in minutes) for an org's active store.
 * Falls back to 0 (UTC) if unavailable.
 */
export async function getShopUtcOffsetMinutes(
  ctx: GenericActionCtx<DataModel>,
  organizationId: string,
): Promise<number> {
  const info = await getShopTimeInfo(ctx, organizationId);
  return info.offsetMinutes ?? 0;
}
