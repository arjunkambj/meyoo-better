import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Record usage for an org (and optional user)
export const recordUsage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(
      v.literal("orders"),
      v.literal("activeClients"),
      v.literal("aiMessages")
    ),
    countDelta: v.number(),
    subjectId: v.optional(v.id("users")),
    month: v.optional(v.string()), // defaults to current YYYY-MM
    limit: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const month = args.month || new Date().toISOString().slice(0, 7);
    const existing = await ctx.db
      .query("usage")
      .withIndex("by_org_month_type", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("month", month)
          .eq("type", args.type)
      )
      .collect();

    const row = args.subjectId
      ? existing.find((u) => u.subjectId === args.subjectId)
      : existing[0];

    if (row) {
      await ctx.db.patch(row._id, {
        count: (row.count || 0) + args.countDelta,
        limit: args.limit ?? row.limit,
        metadata: args.metadata ?? row.metadata,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("usage", {
        organizationId: args.organizationId,
        month,
        type: args.type,
        subjectId: args.subjectId,
        count: Math.max(0, args.countDelta),
        limit: args.limit,
        metadata: args.metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const getUsage = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(
      v.literal("orders"),
      v.literal("activeClients"),
      v.literal("aiMessages")
    ),
    month: v.optional(v.string()),
    subjectId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const month = args.month || new Date().toISOString().slice(0, 7);
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_org_month_type", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("month", month)
          .eq("type", args.type)
      )
      .collect();

    if (args.subjectId) {
      return rows.find((r) => r.subjectId === args.subjectId) || null;
    }
    return rows[0] || null;
  },
});
