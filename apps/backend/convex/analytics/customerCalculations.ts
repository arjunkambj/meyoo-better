import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

/**
 * Customer Metrics Calculations
 * Calculates and stores customer lifetime value, segments, and other metrics
 */

/**
 * Calculate and store customer metrics after orders sync
 */
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

      // Calculate purchase frequency (orders per month)
      const firstOrderDate = new Date(firstOrder.shopifyCreatedAt);
      const lastOrderDate = new Date(lastOrder.shopifyCreatedAt);
      const monthsActive = Math.max(
        1,
        (lastOrderDate.getTime() - firstOrderDate.getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      );
      const purchaseFrequency = lifetimeOrders / monthsActive;

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
        purchaseFrequency,
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

// Removed the calculateAllCustomerMetrics function as it's not needed currently
