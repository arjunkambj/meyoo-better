import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { getUserAndOrg } from "./auth";
import { normalizeShopDomain } from "./shop";

export type OrgResolutionContext = {
  organizationId?: Id<"organizations"> | null;
  shopDomain?: string | null;
  url?: string | null;
};

type AnyActionCtx = ActionCtx | MutationCtx;

type ResolutionResult = {
  orgId: Id<"organizations">;
  shopDomain: string | null;
};

function toComparableId(id: Id<"organizations">): string {
  return id as unknown as string;
}

export async function resolveOrgIdForContext(
  ctx: AnyActionCtx,
  { organizationId, shopDomain, url }: OrgResolutionContext = {}
): Promise<ResolutionResult> {
  const auth = await getUserAndOrg(ctx);

  let normalizedShopDomain: string | null = shopDomain
    ? normalizeShopDomain(shopDomain)
    : null;

  if (!normalizedShopDomain && url) {
    try {
      const parsed = new URL(url);
      normalizedShopDomain = normalizeShopDomain(parsed.hostname);
    } catch {
      // Ignore URL parsing errors; we'll require explicit identifiers.
    }
  }

  let storeOrgId: Id<"organizations"> | null = null;
  if (normalizedShopDomain) {
    storeOrgId = await ctx.runQuery(
      api.core.organizationLookup.getOrganizationByShopDomain,
      { shopDomain: normalizedShopDomain }
    );

    if (!storeOrgId) {
      throw new ConvexError("Shop domain not linked to any organization");
    }
  }

  const candidates = [auth?.orgId ?? null, organizationId ?? null, storeOrgId]
    .filter(Boolean) as Array<Id<"organizations">>;

  if (candidates.length === 0) {
    throw new ConvexError("Not authenticated");
  }

  const distinctIds = new Set(candidates.map((id) => toComparableId(id)));
  if (distinctIds.size > 1) {
    throw new ConvexError("Organization mismatch");
  }

  const orgId = candidates[0];
  if (!orgId) {
    throw new ConvexError("Organization mismatch");
  }

  return {
    orgId,
    shopDomain: normalizedShopDomain,
  };
}
