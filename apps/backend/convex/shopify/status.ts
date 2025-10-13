import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ContextWithDb } from "./shared";
import { logger } from "./shared";

export async function hasCompletedInitialShopifySync(
  ctx: ContextWithDb,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  if (ctx?.db?.query) {
    const onboarding = await (ctx.db.query("onboarding") as any)
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    if (!onboarding) {
      return true;
    }

    return Boolean(onboarding.isInitialSyncComplete);
  }

  if (typeof ctx?.runQuery === "function") {
    const onboardingRecords = (await ctx.runQuery(
      internal.webhooks.processor.getOnboardingByOrganization as any,
      { organizationId },
    )) as unknown;

    const onboarding = Array.isArray(onboardingRecords)
      ? onboardingRecords[0]
      : onboardingRecords;

    if (!onboarding) {
      return true;
    }

    return Boolean(
      (onboarding as Record<string, unknown>).isInitialSyncComplete,
    );
  }

  logger.warn("Unable to determine initial sync status - missing db/runQuery", {
    organizationId,
  });
  return true;
}

export const getInitialSyncStatusInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await hasCompletedInitialShopifySync(
      ctx,
      args.organizationId as Id<"organizations">,
    );
  },
});
