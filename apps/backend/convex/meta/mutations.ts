import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { createJob, PRIORITY, type SyncJobData } from "../engine/workpool";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { storeAdAccounts } from "./storage";
import type { MetaAdAccount } from "./types";

export const connectMeta = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.optional(v.number()),
    scope: v.optional(v.string()),
    userId: v.string(),
    userName: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    await ctx.db.insert("integrationSessions", {
      organizationId: user.organizationId,
      userId: user._id,
      platform: "meta",
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresIn ? Date.now() + args.expiresIn * 1000 : undefined,
      scope: args.scope,
      accountId: args.userId,
      accountName: args.userName,
      isActive: true,
      lastUsedAt: Date.now(),
      metadata: {
        additionalScopes: args.scope ? args.scope.split(" ") : [],
        tokenKind: "short",
        lastRefreshedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    try {
      await ctx.scheduler.runAfter(
        0,
        internal.meta.tokenManager.getValidAccessToken,
        {
          organizationId: user.organizationId as Id<"organizations">,
          platform: "meta",
        },
      );
    } catch (error) {
      console.warn("[Meta] Failed to schedule token exchange action", error);
    }

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q
          .eq("userId", user._id)
          .eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        hasMetaConnection: true,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(user._id, { updatedAt: Date.now() });

    return { success: true };
  },
});

export const setPrimaryAdAccount = mutation({
  args: { accountId: v.string() },
  returns: v.object({ success: v.boolean(), jobScheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    const accounts = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .collect();

    const target = accounts.find((acc) => acc.accountId === args.accountId);
    if (!target) return { success: false, jobScheduled: false };

    const currentPrimary = accounts.find((acc) => acc.isPrimary);

    if (!target.isPrimary) {
      await ctx.db.patch(target._id, { isPrimary: true, updatedAt: Date.now() });
    }

    if (currentPrimary && currentPrimary._id !== target._id) {
      await ctx.db.patch(currentPrimary._id, {
        isPrimary: false,
        updatedAt: Date.now(),
      });
    }

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    if (onboarding && onboarding.onboardingStep === 4) {
      await ctx.db.patch(onboarding._id, {
        onboardingStep: 5,
        updatedAt: Date.now(),
      });
    }

    let jobScheduled = false;
    if (user.organizationId) {
      const recentSync = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_account_org", (q) =>
          q
            .eq("accountId", args.accountId)
            .eq("organizationId", user.organizationId as Id<"organizations">),
        )
        .first();

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const shouldSync = !recentSync?.syncedAt || recentSync.syncedAt < oneHourAgo;

      if (shouldSync) {
        try {
          await createJob(
            ctx as any,
            "sync:initial",
            PRIORITY.HIGH,
            {
              organizationId: user.organizationId as Id<"organizations">,
              platform: "meta",
              syncType: "initial",
              dateRange: { daysBack: 60 },
              accountId: args.accountId,
            } as SyncJobData,
          );
          jobScheduled = true;
        } catch (error) {
          console.warn("[Meta] Failed to schedule initial fetch job", error);
        }
      }
    }

    return { success: true, jobScheduled };
  },
});

export const storeAdAccountsFromCallback = mutation({
  args: { accounts: v.array(v.any()) },
  returns: v.object({ success: v.boolean(), stored: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    const normalized = (args.accounts as MetaAdAccount[]).map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      timezone_name: account.timezone ?? account.timezone_name,
      account_status: account.accountStatus ?? account.account_status,
      spend_cap: account.spendCap ?? account.spend_cap,
      amount_spent: account.amountSpent ?? account.amount_spent,
      business_id: account.business_id ?? account.business?.id,
      business_name: account.business_name ?? account.business?.name,
      timezone_offset_hours_utc: account.timezone_offset_hours_utc,
      disable_reason: account.disable_reason,
    } as MetaAdAccount));

    await storeAdAccounts(ctx as any, user.organizationId as Id<"organizations">, normalized);

    try {
      await createJob(
        ctx as any,
        "maintenance:dedupe_meta_accounts",
        PRIORITY.BACKGROUND,
        {
          organizationId: user.organizationId as Id<"organizations">,
        } as any,
      );
    } catch (error) {
      console.warn("[Meta] Failed to enqueue dedupe job", error);
    }

    return { success: true, stored: normalized.length };
  },
});
