
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logger } from "./shared";

export const handleGDPRDataRequest = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
    customerId: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    ordersRequested: v.array(v.string()),
    dataRequestId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Find the store
      const store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
        .first();

      if (!store) {
        throw new Error(`Store not found for domain: ${args.shopDomain}`);
      }

      // Get customer data
      const customer = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_shopify_id_store", (q) =>
          q.eq("shopifyId", args.customerId).eq("storeId", store._id)
        )
        .first();

      // Get requested orders
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      const orders =
        args.ordersRequested.length > 0
          ? allOrders.filter((o) => args.ordersRequested.includes(o.shopifyId))
          : customer?.email
            ? allOrders.filter((o) => o.email === customer.email)
            : [];

      // Compile customer data
      const customerData = {
        customer: customer || null,
        orders: orders,
        requestedAt: Date.now(),
        shopDomain: args.shopDomain,
        dataRequestId: args.dataRequestId,
      };

      // Log the data request for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_data_request",
        status: "completed",
        requestData: customerData,
        processedAt: Date.now(),
      });

      logger.info("GDPR customer data request processed", {
        customerId: args.customerId,
        orderCount: orders.length,
      });

      return null;
    } catch (error) {
      logger.error("GDPR customer data request failed", error, {
        customerId: args.customerId,
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_data_request",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Internal GDPR handler for customer redact
 */
export const handleGDPRRedact = internalMutation({
  args: {
    organizationId: v.string(),
    shopDomain: v.string(),
    customerId: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    ordersToRedact: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Find the store
      const store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_shop_domain", (q) => q.eq("shopDomain", args.shopDomain))
        .first();

      if (!store) {
        throw new Error(`Store not found for domain: ${args.shopDomain}`);
      }

      let redactedRecords = 0;

      // Delete customer data
      const customer = await ctx.db
        .query("shopifyCustomers")
        .withIndex("by_shopify_id_store", (q) =>
          q.eq("shopifyId", args.customerId).eq("storeId", store._id)
        )
        .first();

      if (customer) {
        await ctx.db.delete(customer._id);
        redactedRecords++;
      }

      // Redact personal information from orders
      const allOrders = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      const ordersToUpdate =
        args.ordersToRedact.length > 0
          ? allOrders.filter((o) => args.ordersToRedact.includes(o.shopifyId))
          : customer?.email
            ? allOrders.filter((o) => o.email === customer.email)
            : [];

      for (const order of ordersToUpdate) {
        // Redact personal information
        await ctx.db.patch(order._id, {
          email: "REDACTED",
          phone: "REDACTED",
          // Note: We're not redacting address fields as they're not in the schema
          // In a production app, you would include address redaction if those fields exist
        });
        redactedRecords++;
      }

      // Log the redact request for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_redact",
        status: "completed",
        requestData: { redactedRecords, ordersRedacted: ordersToUpdate.length },
        processedAt: Date.now(),
      });

      logger.info("GDPR customer redact completed", {
        customerId: args.customerId,
        redactedRecords,
      });

      return null;
    } catch (error) {
      logger.error("GDPR customer redact failed", error, {
        customerId: args.customerId,
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: args.customerId,
        requestType: "customer_redact",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Internal GDPR handler for shop redact
 */
export const handleGDPRShopRedact = internalMutation({
  args: {
    organizationId: v.string(),
    shopId: v.string(),
    shopDomain: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      logger.info(
        "GDPR shop redact requested - performing complete data reset",
        {
          organizationId: args.organizationId,
          shopDomain: args.shopDomain,
        }
      );

      // Call the comprehensive app uninstall handler for complete data reset
      // This will delete all integration data and reset user state
      // We'll call the internal mutation directly
      await ctx.runMutation(
        internal.shopify.lifecycle.handleAppUninstalled,
        {
          organizationId: args.organizationId,
          shopDomain: args.shopDomain,
        }
      );

      // Log the GDPR shop redact for compliance
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: "shop", // Special identifier for shop redaction
        requestType: "shop_redact",
        status: "completed",
        requestData: {
          message: "Complete data reset performed via app uninstall handler",
          timestamp: Date.now(),
        },
        processedAt: Date.now(),
      });

      logger.info("GDPR shop redact completed - all data reset", {
        shopDomain: args.shopDomain,
      });

      return null;
    } catch (error) {
      logger.error("GDPR shop redact failed", error, {
        shopDomain: args.shopDomain,
      });

      // Log failed request
      await ctx.db.insert("gdprRequests", {
        organizationId: args.organizationId as Id<"organizations">,
        shopDomain: args.shopDomain,
        customerId: "shop",
        requestType: "shop_redact",
        status: "failed",
        requestData: {
          error: error instanceof Error ? error.message : String(error),
        },
        processedAt: Date.now(),
      });

      throw error;
    }
  },
});

/**
 * Handle app uninstallation - Complete data reset except billing
 * This deletes ALL integration data and resets user to fresh state
 */
