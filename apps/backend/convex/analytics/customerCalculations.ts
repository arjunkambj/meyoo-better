import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";

/**
 * Customer Metrics Calculations
 * Calculates and stores customer lifetime value, segments, and other metrics
 */

const CUSTOMER_METRICS_QUEUE_BATCH_SIZE = 25;
const MAX_QUEUE_BATCHES_PER_RUN = 10;

type QueueStateDoc = Doc<"customerMetricsQueueState">;

async function getQueueState(
  ctx: { db: any },
  organizationId: Id<"organizations">,
): Promise<QueueStateDoc | null> {
  return await ctx.db
    .query("customerMetricsQueueState")
    .withIndex("by_organization", (q: any) =>
      q.eq("organizationId", organizationId),
    )
    .first();
}

async function ensureQueueStateDoc(
  ctx: { db: any },
  organizationId: Id<"organizations">,
): Promise<QueueStateDoc | null> {
  let state = await getQueueState(ctx, organizationId);

  if (!state) {
    await ctx.db.insert("customerMetricsQueueState", {
      organizationId,
      isProcessing: false,
      scheduled: false,
    });

    state = await getQueueState(ctx, organizationId);
  }

  return state;
}

/**
 * Calculate and store customer metrics after orders sync
 */
export const queueCustomerMetrics = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerIds: v.optional(v.array(v.id("shopifyCustomers"))),
  },
  returns: v.object({
    queued: v.number(),
  }),
  handler: async (ctx, args) => {
    let targetCustomerIds = args.customerIds ?? [];

    if (targetCustomerIds.length === 0) {
      const customers = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
      targetCustomerIds = customers.map((customer) => customer._id);
    }

    if (targetCustomerIds.length === 0) {
      // Nothing to enqueue
      await ensureQueueStateDoc(ctx, args.organizationId);
      return { queued: 0 };
    }

    const dedupedCustomerIds = Array.from(
      new Set(targetCustomerIds.map((id) => id as Id<"shopifyCustomers">)),
    );

    let queued = 0;
    const now = Date.now();

    for (const customerId of dedupedCustomerIds) {
      const existing = await ctx.db
        .query("customerMetricsQueue")
        .withIndex("by_org_customer", (q) =>
          q.eq("organizationId", args.organizationId).eq("customerId", customerId),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          enqueuedAt: now,
        });
      } else {
        await ctx.db.insert("customerMetricsQueue", {
          organizationId: args.organizationId,
          customerId,
          enqueuedAt: now,
        });
        queued += 1;
      }
    }

    await ensureQueueStateDoc(ctx, args.organizationId);

    return { queued };
  },
});

export const ensureCustomerMetricsProcessor = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const pendingEntry = await ctx.db
      .query("customerMetricsQueue")
      .withIndex("by_org_enqueued", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (!pendingEntry) {
      return;
    }

    let state = await getQueueState(ctx, args.organizationId);

    if (!state) {
      await ctx.db.insert("customerMetricsQueueState", {
        organizationId: args.organizationId,
        isProcessing: false,
        scheduled: false,
      });
      state = await getQueueState(ctx, args.organizationId);
    }

    if (!state || state.isProcessing || state.scheduled) {
      return;
    }

    await ctx.db.patch(state._id, {
      scheduled: true,
      lastScheduledAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.analytics.customerCalculations.processCustomerMetricsQueue,
      {
        organizationId: args.organizationId,
      },
    );
  },
});

export const claimCustomerMetricsProcessor = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    claimed: v.boolean(),
    stateId: v.id("customerMetricsQueueState"),
  }),
  handler: async (ctx, args) => {
    const state = await getQueueState(ctx, args.organizationId);

    if (!state) {
      const stateId = await ctx.db.insert("customerMetricsQueueState", {
        organizationId: args.organizationId,
        isProcessing: true,
        scheduled: false,
        processingStartedAt: Date.now(),
      });

      return {
        claimed: true,
        stateId,
      };
    }

    if (state.isProcessing) {
      return {
        claimed: false,
        stateId: state._id,
      };
    }

    await ctx.db.patch(state._id, {
      isProcessing: true,
      scheduled: false,
      processingStartedAt: Date.now(),
    });

    return {
      claimed: true,
      stateId: state._id,
    };
  },
});

export const releaseCustomerMetricsProcessor = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const state = await getQueueState(ctx, args.organizationId);

    if (!state) {
      return;
    }

    await ctx.db.patch(state._id, {
      isProcessing: false,
      processingStartedAt: undefined,
    });
  },
});

export const removeCustomerMetricsQueueEntries = internalMutation({
  args: {
    entries: v.array(
      v.object({
        entryId: v.id("customerMetricsQueue"),
        expectedEnqueuedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const entry of args.entries) {
      const existing = await ctx.db.get(entry.entryId);

      // Skip deletion if the entry has been requeued since it was claimed.
      if (!existing || existing.enqueuedAt !== entry.expectedEnqueuedAt) {
        continue;
      }

      await ctx.db.delete(entry.entryId);
    }
  },
});

export const getPendingCustomerMetricsQueue = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerMetricsQueue")
      .withIndex("by_org_enqueued", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("asc")
      .take(args.limit);
  },
});

export const hasPendingCustomerMetrics = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("customerMetricsQueue")
      .withIndex("by_org_enqueued", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    return entry !== null;
  },
});

export const processCustomerMetricsQueue = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.analytics.customerCalculations.claimCustomerMetricsProcessor,
      {
        organizationId: args.organizationId,
      },
    );

    if (!claim.claimed) {
      return;
    }

    let hasRemaining = false;

    try {
      let batchesProcessed = 0;

      while (batchesProcessed < MAX_QUEUE_BATCHES_PER_RUN) {
        const entries = (await ctx.runQuery(
          internal.analytics.customerCalculations.getPendingCustomerMetricsQueue,
          {
            organizationId: args.organizationId,
            limit: CUSTOMER_METRICS_QUEUE_BATCH_SIZE,
          },
        )) as Doc<"customerMetricsQueue">[];

        if (entries.length === 0) {
          break;
        }

        const customerIds = entries.map((entry) => entry.customerId);

        await ctx.runMutation(
          internal.analytics.customerCalculations.calculateCustomerMetrics,
          {
            organizationId: args.organizationId,
            customerIds,
          },
        );

        await ctx.runMutation(
          internal.analytics.customerCalculations.removeCustomerMetricsQueueEntries,
          {
            entries: entries.map((entry) => ({
              entryId: entry._id,
              expectedEnqueuedAt: entry.enqueuedAt,
            })),
          },
        );

        batchesProcessed += 1;
      }

      hasRemaining = await ctx.runQuery(
        internal.analytics.customerCalculations.hasPendingCustomerMetrics,
        {
          organizationId: args.organizationId,
        },
      );
    } catch (error) {
      console.error("Failed to process customer metrics queue", {
        organizationId: String(args.organizationId),
        error,
      });
      hasRemaining = true;
      throw error;
    } finally {
      await ctx.runMutation(
        internal.analytics.customerCalculations.releaseCustomerMetricsProcessor,
        {
          organizationId: args.organizationId,
        },
      );

      if (hasRemaining) {
        await ctx.runMutation(
          internal.analytics.customerCalculations.ensureCustomerMetricsProcessor,
          {
            organizationId: args.organizationId,
          },
        );
      }
    }
  },
});

export const calculateCustomerMetrics = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerIds: v.optional(v.array(v.id("shopifyCustomers"))),
  },
  handler: async (ctx, args) => {
    // Get all customers if not specified
    let customers: Doc<"shopifyCustomers">[];

    if (args.customerIds && args.customerIds.length > 0) {
      const customerResults = await Promise.all(
        args.customerIds.map((id) => ctx.db.get(id)),
      );
      customers = customerResults.filter(
        (c): c is Doc<"shopifyCustomers"> => c !== null,
      );
    } else {
      customers = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
    }

    if (customers.length === 0) return;

    // Get all orders for this organization
    const allOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Process each customer
    for (const customer of customers) {
      if (!customer) continue;

      // Get all orders for this customer
      const customerOrders = allOrders.filter(
        (order) => order.customerId === customer._id,
      );

      if (customerOrders.length === 0) {
        // No orders for this customer yet
        continue;
      }

      // Sort orders by date
      customerOrders.sort((a, b) => a.shopifyCreatedAt - b.shopifyCreatedAt);

      // Calculate metrics
      const firstOrder = customerOrders[0]!;
      const lastOrder = customerOrders[customerOrders.length - 1]!;

      const lifetimeValue = customerOrders.reduce(
        (sum, order) => sum + (order.totalPrice || 0),
        0,
      );

      const lifetimeOrders = customerOrders.length;
      const avgOrderValue = lifetimeValue / lifetimeOrders;

      // Calculate lifetime profit (revenue minus costs)
      const lifetimeProfit = customerOrders.reduce((sum, order) => {
        // Simple profit calculation - can be enhanced with actual cost data
        const orderProfit = (order.totalPrice || 0) * 0.3; // Assume 30% margin

        return sum + orderProfit;
      }, 0);

      const firstOrderDate = new Date(firstOrder.shopifyCreatedAt);
      const lastOrderDate = new Date(lastOrder.shopifyCreatedAt);

      // Calculate days between purchases
      let daysBetweenPurchases = 0;

      if (lifetimeOrders > 1) {
        const totalDays =
          (lastOrderDate.getTime() - firstOrderDate.getTime()) /
          (1000 * 60 * 60 * 24);

        daysBetweenPurchases = totalDays / (lifetimeOrders - 1);
      }

      // Determine segment: new (1 order) or repeated (2+ orders)
      let segment: "new" | "repeated" = "new";

      if (lifetimeOrders === 0) {
        segment = "new"; // No orders yet
      } else if (lifetimeOrders === 1) {
        segment = "new";
      } else {
        segment = "repeated";
      }

      // Calculate days since last order for activity status
      const daysSinceLastOrder = lastOrder
        ? Math.floor(
            (Date.now() - lastOrder.shopifyCreatedAt) / (1000 * 60 * 60 * 24),
          )
        : 999;

      // Check if metrics already exist for this customer
      const existingMetrics = await ctx.db
        .query("customerMetrics")
        .withIndex("by_customer", (q) => q.eq("customerId", customer._id))
        .first();

      const metricsData = {
        organizationId: args.organizationId,
        customerId: customer._id,
        date: new Date().toISOString().substring(0, 10),
        firstOrderDate: firstOrderDate.toISOString().substring(0, 10),
        lastOrderDate: lastOrderDate.toISOString().substring(0, 10),
        lifetimeValue,
        lifetimeOrders,
        lifetimeProfit,
        avgOrderValue,
        daysBetweenPurchases,
        segment,
        // Attribution - can be enhanced with actual channel data
        firstTouchChannel: "organic", // Default for now
        lastTouchChannel: "direct",
        // Status
        isActive: daysSinceLastOrder <= 90,
        churnRisk:
          daysSinceLastOrder > 180
            ? "high"
            : daysSinceLastOrder > 90
              ? "medium"
              : "low",
        // Cohort
        cohort: firstOrderDate.toISOString().substring(0, 7), // YYYY-MM
        calculatedAt: Date.now(),
      };

      if (existingMetrics) {
        // Update existing metrics
        await ctx.db.patch(existingMetrics._id, metricsData);
      } else {
        // Insert new metrics
        await ctx.db.insert("customerMetrics", metricsData);
      }
    }

    // production: avoid noisy analytics logs
  },
});

/**
 * Lightweight action wrapper so callers can trigger the heavy mutation
 * outside of their own transaction and avoid OCC conflicts.
 */
export const enqueueCustomerMetricsCalculation = internalAction({
  args: {
    organizationId: v.id("organizations"),
    customerIds: v.optional(v.array(v.id("shopifyCustomers"))),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(
        internal.analytics.customerCalculations.queueCustomerMetrics,
        {
          organizationId: args.organizationId,
          customerIds: args.customerIds,
        },
      );

      await ctx.runMutation(
        internal.analytics.customerCalculations.ensureCustomerMetricsProcessor,
        {
          organizationId: args.organizationId,
        },
      );
    } catch (error) {
      console.error(
        "Failed to enqueue customer metrics calculation",
        {
          organizationId: String(args.organizationId),
          customerCount: args.customerIds?.length ?? "all",
          error,
        },
      );
    }
  },
});

// Removed the calculateAllCustomerMetrics function as it's not needed currently
