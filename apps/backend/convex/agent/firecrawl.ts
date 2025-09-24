import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getOnboardingForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("onboarding")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
  },
});

export const markFirecrawlSeeded = internalMutation({
  args: {
    onboardingId: v.id("onboarding"),
    url: v.string(),
    summary: v.string(),
    pageCount: v.number(),
  },
  handler: async (ctx, { onboardingId, url, summary, pageCount }) => {
    const existing = await ctx.db.get(onboardingId);
    await ctx.db.patch(onboardingId, {
      onboardingData: {
        ...(existing?.onboardingData || {}),
        firecrawlSeededAt: new Date().toISOString(),
        firecrawlSeededUrl: url,
        firecrawlSummary: summary,
        firecrawlPageCount: pageCount,
      },
      updatedAt: Date.now(),
    });
  },
});
