
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import { logger } from "./shared";
import { findShopifyStoreByDomain } from "../utils/shop";

export const webhooks = {
  /**
   * Handle order webhooks
   */
  handleOrderWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { topic, payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      // Process based on topic
      switch (topic) {
        case "orders/create":
          await ctx.runMutation(
            internal.shopify.orderMutations.storeOrdersInternal,
            {
              organizationId,
              orders: [payload],
            }
          );
          break;

        case "orders/cancelled": {
          const orderIdentifier = payload.shopifyId ?? payload.id;

          if (!orderIdentifier) {
            throw new Error("Order ID not found in payload");
          }

          await ctx.runMutation(
            internal.shopify.orderMutations.updateOrderStatusInternal,
            {
              organizationId,
              orderId: String(orderIdentifier),
              financialStatus: "cancelled",
              fulfillmentStatus: "cancelled",
            }
          );
          break;
        }
      }

      return null;
    },
  }),

  /**
   * Handle product webhooks
   */
  handleProductWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { topic, payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      switch (topic) {
        case "products/create":
        case "products/update":
          await ctx.runMutation(
            internal.shopify.productMutations.storeProductsInternal,
            {
              organizationId,
              products: [payload],
            }
          );
          break;

        case "products/delete": {
          // Mark product as deleted
          const product = await ctx.db
            .query("shopifyProducts")
            .withIndex("by_shopify_id", (q) => q.eq("shopifyId", payload.id))
            .first();

          if (product) {
            await ctx.db.patch(product._id, {
              status: "deleted",
              syncedAt: Date.now(),
            });
          }
          break;
        }
      }

      return null;
    },
  }),

  /**
   * Handle customer webhooks
   */
  handleCustomerWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      await ctx.runMutation(
        internal.shopify.customerMutations.storeCustomersInternal,
        {
          organizationId,
          customers: [payload],
        }
      );

      return null;
    },
  }),

  /**
   * Handle refund webhooks
   */
  handleRefundWebhook: internalMutation({
    args: {
      topic: v.string(),
      payload: v.any(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      const { payload } = args;
      const organizationId = payload.organizationId;

      if (!organizationId) {
        throw new Error("Organization ID not found in payload");
      }

      // Find the order first to get the orderId
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", payload.order_id))
        .first();

      if (!order) {
        throw new Error(`Order not found for refund: ${payload.order_id}`);
      }

      // Store refund in separate table as per schema
      await ctx.db.insert("shopifyRefunds", {
        organizationId,
        orderId: order._id,
        shopifyId: payload.id,
        shopifyOrderId: payload.order_id,
        note: payload.note,
        userId: payload.user_id,
        totalRefunded: parseFloat(payload.amount || "0"),
        refundLineItems:
          payload.refund_line_items?.map(
            (item: {
              line_item_id: string;
              quantity: number;
              subtotal: string;
            }) => ({
              lineItemId: item.line_item_id,
              quantity: item.quantity,
              subtotal: parseFloat(item.subtotal || "0"),
            })
          ) || [],
        shopifyCreatedAt: payload.created_at,
        processedAt: payload.processed_at,
      });

      return null;
    },
  }),

  /**
   * Handle app uninstall
   */
  handleAppUninstall: internalMutation({
    args: {
      shopDomain: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
      await ctx.runMutation(
        internal.shopify.lifecycle.handleAppUninstallInternal,
        {
          shopDomain: args.shopDomain,
        }
      );

      return null;
    },
  }),

  /**
   * Handle customer data request (GDPR compliance)
   */
  handleCustomerDataRequest: mutation({
    args: {
      shopDomain: v.string(),
      customerId: v.string(),
      ordersRequested: v.optional(v.array(v.string())),
    },
    returns: v.object({
      success: v.boolean(),
      customerData: v.any(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await findShopifyStoreByDomain(ctx.db, args.shopDomain);

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

        // Get customer orders by email if customer exists
        const allOrders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        const orders = customer?.email
          ? allOrders.filter((o) => o.email === customer.email)
          : [];

        // Compile customer data for GDPR request
        const customerData = {
          customer: customer || null,
          orders: orders,
          requestedAt: Date.now(),
          shopDomain: args.shopDomain,
        };

        // Log the data request for compliance tracking
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: args.customerId,
          requestType: "customer_data_request",
          status: "completed",
          requestData: customerData,
          processedAt: Date.now(),
        });

        return {
          success: true,
          customerData,
        };
      } catch (error) {
        logger.error("Customer data request failed", error, {
          customerId: args.customerId,
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          customerData: null,
        };
      }
    },
  }),

  /**
   * Handle customer redact request (GDPR compliance)
   */
  handleCustomerRedact: mutation({
    args: {
      shopDomain: v.string(),
      customerId: v.string(),
      ordersToRedact: v.optional(v.array(v.string())),
    },
    returns: v.object({
      success: v.boolean(),
      redactedRecords: v.number(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await findShopifyStoreByDomain(ctx.db, args.shopDomain);

        if (!store) {
          throw new Error(`Store not found for domain: ${args.shopDomain}`);
        }

        let redactedRecords = 0;

        // Redact customer data
        const customer = await ctx.db
          .query("shopifyCustomers")
          .withIndex("by_shopify_id_store", (q) =>
            q.eq("shopifyId", args.customerId).eq("storeId", store._id)
          )
          .first();

        if (customer) {
          await ctx.db.patch(customer._id, {
            // Redact personal information
            email: "[REDACTED]",
            firstName: "[REDACTED]",
            lastName: "[REDACTED]",
            phone: "[REDACTED]",
            // Keep business-relevant data for analytics
            totalSpent: customer.totalSpent,
            ordersCount: customer.ordersCount,
          });
          redactedRecords++;
        }

        // Redact customer data from orders but keep business metrics
        const allOrders = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_store", (q) => q.eq("storeId", store._id))
          .collect();

        const orders = customer?.email
          ? allOrders.filter((o) => o.email === customer.email)
          : [];

        for (const order of orders) {
          await ctx.db.patch(order._id, {
            // Redact personal information
            email: "[REDACTED]",
            shippingAddress: {
              // Redact all address fields as per schema
              country: "[REDACTED]",
              province: "[REDACTED]",
              city: "[REDACTED]",
              zip: "[REDACTED]",
            },
            // Keep business-relevant data
            totalPrice: order.totalPrice,
            subtotalPrice: order.subtotalPrice,
          });
          redactedRecords++;
        }

        // Log the redaction for compliance tracking
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: args.customerId,
          requestType: "customer_redact",
          status: "completed",
          requestData: {
            customerId: args.customerId,
            ordersToRedact: args.ordersToRedact,
            redactedRecords,
          },
          processedAt: Date.now(),
        });

        return {
          success: true,
          redactedRecords,
        };
      } catch (error) {
        logger.error("Customer redaction failed", error, {
          customerId: args.customerId,
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          redactedRecords: 0,
        };
      }
    },
  }),

  /**
   * Handle shop redact request (GDPR compliance)
   */
  handleShopRedact: mutation({
    args: {
      shopDomain: v.string(),
    },
    returns: v.object({
      success: v.boolean(),
      message: v.string(),
    }),
    handler: async (ctx, args) => {
      try {
        // Find the organization by shop domain
        const store = await findShopifyStoreByDomain(ctx.db, args.shopDomain);

        if (!store) {
          return {
            success: true,
            message: "Shop data not found - no action needed",
          };
        }

        // Mark store as uninstalled and redacted
        await ctx.db.patch(store._id, {
          isActive: false,
          uninstalledAt: Date.now(),
        });

        // Mark integration session as inactive
        const sessions = await ctx.db
          .query("integrationSessions")
          .withIndex("by_org_and_platform", (q) =>
            q
              .eq("organizationId", store.organizationId as Id<"organizations">)
              .eq("platform", "shopify")
          )
          .collect();

        for (const session of sessions) {
          await ctx.db.patch(session._id, {
            isActive: false,
          });
        }

        // Log the shop redaction
        await ctx.db.insert("gdprRequests", {
          organizationId: store.organizationId,
          shopDomain: args.shopDomain,
          customerId: "shop",
          requestType: "shop_redact",
          status: "completed",
          requestData: {
            shopDomain: args.shopDomain,
            action: "shop_uninstalled_and_redacted",
          },
          processedAt: Date.now(),
        });

        return {
          success: true,
          message: "Shop data marked as redacted successfully",
        };
      } catch (error) {
        logger.error("Shop redaction failed", error, {
          shopDomain: args.shopDomain,
        });

        return {
          success: false,
          message: `Shop redaction failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  }),
};

/**
 * Internal GDPR handler for customer data request
 */
