
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const updateShopDetailsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopId: v.string(),
    domain: v.string(),
    planName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("isActive", true)
      )
      .first();

    if (store) {
      await ctx.db.patch(store._id, {
        shopDomain: args.domain,
        // Note: planName is not in the schema, would need to add it if required
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
