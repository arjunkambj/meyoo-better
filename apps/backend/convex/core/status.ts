import { v } from "convex/values";

import { query, internalMutation } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";
import {
  computeIntegrationStatus,
  emptyIntegrationStatus,
  integrationStatusValidator,
} from "../utils/integrationStatus";

export const getIntegrationStatus = query({
  args: {},
  returns: integrationStatusValidator,
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return emptyIntegrationStatus();
    }

    return await computeIntegrationStatus(ctx, auth.orgId);
  },
});

// Optional: snapshot writer to cache status in integrationStatus table
export const refreshIntegrationStatus = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const status = await computeIntegrationStatus(ctx, args.organizationId);

    const existing = await ctx.db
      .query("integrationStatus")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const payload = {
      organizationId: args.organizationId,
      ...status,
      updatedAt: Date.now(),
    } as const;

    if (existing) {
      await ctx.db.patch(existing._id, payload as any);
    } else {
      await ctx.db.insert("integrationStatus", payload as any);
    }

    return { ok: true } as const;
  },
});
