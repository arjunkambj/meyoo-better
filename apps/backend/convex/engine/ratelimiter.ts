import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Simple token-bucket rate limiter per platform using platformRateLimits table.
 * Window = current hour (UTC). Limit for Meta defaults to 10_000 tokens/hour.
 */

function currentHourWindow() {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const start = Math.floor(now / hourMs) * hourMs;
  return { start, end: start + hourMs };
}

export const getBucket = internalQuery({
  args: { platform: v.string() },
  handler: async (ctx, args) => {
    const { start, end } = currentHourWindow();
    const existing = await (ctx.db as any)
      .query("platformRateLimits")
      .withIndex("by_platform", (q: any) => q.eq("platform", args.platform))
      .first();
    if (!existing || existing.windowEnd <= Date.now()) {
      return {
        platform: args.platform,
        windowStart: start,
        windowEnd: end,
        used: 0,
        limit: args.platform === "meta" ? 10_000 : 10_000,
        updatedAt: Date.now(),
      };
    }
    return existing;
  },
});

export const acquire = internalMutation({
  args: { platform: v.string(), cost: v.number() },
  returns: v.object({ ok: v.boolean(), resetAt: v.number() }),
  handler: async (ctx, args) => {
    const { start, end } = currentHourWindow();
    const res = await ctx.runQuery((internal as any).engine.ratelimiter.getBucket, {
      platform: args.platform,
    });

    // Fresh window if expired or not existing
    let doc = await (ctx.db as any)
      .query("platformRateLimits")
      .withIndex("by_platform", (q: any) => q.eq("platform", args.platform))
      .first();

    if (!doc || doc.windowEnd <= Date.now()) {
      const id = await (ctx.db as any).insert("platformRateLimits", {
        platform: args.platform,
        windowStart: start,
        windowEnd: end,
        used: 0,
        limit: res.limit,
        updatedAt: Date.now(),
      });
      doc = await (ctx.db as any).get(id);
    }

    if (!doc) return { ok: false, resetAt: end };

    if (doc.used + args.cost > doc.limit) {
      return { ok: false, resetAt: doc.windowEnd };
    }

    await (ctx.db as any).patch(doc._id, {
      used: doc.used + args.cost,
      updatedAt: Date.now(),
    });

    return { ok: true, resetAt: doc.windowEnd };
  },
});
