import { v } from "convex/values";
import { createSimpleLogger } from "../../libs/logging/simple";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { optionalEnv, requireEnv } from "../utils/env";
import { msToDateString } from "../utils/date";

const META_TICK_MINUTES = Number(requireEnv("META_TICK_MINUTES"));
if (Number.isNaN(META_TICK_MINUTES) || META_TICK_MINUTES <= 0) {
  throw new Error("META_TICK_MINUTES must be a positive number");
}

const META_BATCH_SIZE = (() => {
  const raw = optionalEnv("META_BATCH_SIZE");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("META_BATCH_SIZE must be a positive number when provided");
  }
  return parsed;
})();

const LOG_META_ENABLED = optionalEnv("LOG_META") === "1";

// List Meta ad accounts (all orgs)
export const listMetaAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Only consider active accounts; prefer primary per organization
    const active = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Group by organization and pick primary if set; otherwise pick first
    const byOrg = new Map<string, Doc<"metaAdAccounts">[]>();
    for (const a of active) {
      const org = String(a.organizationId);
      const list = byOrg.get(org) || [];
      list.push(a);
      byOrg.set(org, list);
    }

    const selected: Array<{
      _id: Id<"metaAdAccounts">;
      organizationId: Id<"organizations">;
      accountId: string;
      timezone?: string;
      timezoneOffsetMinutes?: number;
    }> = [];
    for (const [, list] of byOrg.entries()) {
      const primary = list.find((x) => x.isPrimary === true) || list[0];
      if (primary) {
        const timezoneOffsetMinutes =
          typeof primary.timezoneOffsetHours === "number" && Number.isFinite(primary.timezoneOffsetHours)
            ? Math.round(primary.timezoneOffsetHours * 60)
            : undefined;
        selected.push({
          _id: primary._id as Id<"metaAdAccounts">,
          organizationId: primary.organizationId as Id<"organizations">,
          accountId: primary.accountId as string,
          timezone: primary.timezone ?? undefined,
          timezoneOffsetMinutes,
        });
      }
    }

    return selected;
  },
});

// Simple round-robin cursor stored in schedulerState("meta:cursor")
export const getCursor = internalQuery({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("schedulerState")
      .withIndex("by_name", (q) => q.eq("name", "meta:cursor"))
      .first();
    const val = doc?.value as { index?: number } | undefined;
    return (val?.index ?? 0) as number;
  },
});

export const setCursor = internalMutation({
  args: { index: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("schedulerState")
      .withIndex("by_name", (q) => q.eq("name", "meta:cursor"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: { index: args.index }, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("schedulerState", {
      name: "meta:cursor",
      value: { index: args.index },
      updatedAt: Date.now(),
    });
  },
});

export const tick = internalAction({
  args: {},
  returns: v.object({ processed: v.number(), deferred: v.number() }),
  handler: async (ctx) => {
    const logger = createSimpleLogger("MetaScheduler");
    const tickMinutes = META_TICK_MINUTES;
    const accounts = await ctx.runQuery(internal.engine.metaScheduler.listMetaAccounts, {});
    if (accounts.length === 0) return { processed: 0, deferred: 0 };

    const start = (await ctx.runQuery(internal.engine.metaScheduler.getCursor, {})) % accounts.length;

    let processed = 0;
    let deferred = 0;
    const _startedAt = Date.now();

    // Determine dynamic capacity per tick based on global hourly limit
    const bucket = await ctx.runQuery(internal.engine.ratelimiter.getBucket, {
      platform: "meta",
    });
    const ticksPerHour = Math.max(1, Math.floor(60 / tickMinutes));
    const nominalPerTick = Math.max(1, Math.floor((bucket?.limit ?? 10_000) / ticksPerHour));
    const remaining = Math.max(0, (bucket?.limit ?? 10_000) - (bucket?.used ?? 0));
    const ceiling = META_BATCH_SIZE ?? nominalPerTick;
    const capacity = Math.min(nominalPerTick, remaining, ceiling);
    const toTake = Math.min(capacity, accounts.length);
    if (LOG_META_ENABLED) {
      logger.info("Meta tick start", {
        at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < toTake; i++) {
      const idx = (start + i) % accounts.length;
      const a = accounts[idx];
      if (!a) {
        deferred += (toTake - i);
        break;
      }

      // Acquire 1 token for one insights request
      const acquired = await ctx.runMutation(
        internal.engine.ratelimiter.acquire,
        {
          platform: "meta",
          cost: 1,
        },
      );
      if (!acquired?.ok) {
        deferred += (toTake - i);
        break;
      }

      try {
        // Pull today's insights (minimal)
        const today =
          msToDateString(Date.now(), {
            timezone: a.timezone,
            offsetMinutes: typeof a.timezoneOffsetMinutes === "number" ? a.timezoneOffsetMinutes : undefined,
          }) ?? new Date().toISOString().slice(0, 10);
        await ctx.runAction(internal.meta.sync.pullDaily, {
          organizationId: a.organizationId,
          accountId: a.accountId,
          date: today,
        });
        processed++;
      } catch (_e) {
        // Skip errors; next tick will retry
      }
    }

    const nextIndex = (start + processed) % accounts.length;
    await ctx.runMutation(internal.engine.metaScheduler.setCursor, { index: nextIndex });

    // compute duration if needed in logs
    if (LOG_META_ENABLED) {
      logger.info("Meta tick done", {
        at: new Date().toISOString(),
        processed,
        deferred,
      });
    }
    return { processed, deferred };
  },
});
