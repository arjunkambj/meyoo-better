import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";

// Returns the primary currency code for an organization, preferring active stores
export const getPrimaryCurrencyForOrg = query({
  args: { orgId: v.id("organizations") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const orgId = args.orgId as Id<"organizations">;

    const activeStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", orgId).eq("isActive", true),
      )
      .first();
    if (activeStore?.primaryCurrency) {
      return activeStore.primaryCurrency as string;
    }

    const fallbackStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    return (fallbackStore?.primaryCurrency as string | undefined) ?? null;
  },
});
