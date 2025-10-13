
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { roundMoney } from "../../libs/utils/money";
import { msToDateString, type MsToDateOptions } from "../utils/date";
import { toStringArray } from "../utils/shopify";
import {
  ANALYTICS_REBUILD_DEBOUNCE_MS,
  BULK_OPS,
  ORDER_WEBHOOK_MAX_RETRIES,
  ORDER_WEBHOOK_RETRY_DELAY_MS,
  chunkArray,
  logger,
} from "./shared";
import {
  hasCustomerWebhookChange,
  hasOrderMeaningfulChange,
  hasOrderItemMeaningfulChange,
  hasRefundMeaningfulChange,
  hasTransactionMeaningfulChange,
  toOptionalString,
} from "./processingUtils";
import { hasCompletedInitialShopifySync } from "./status";

export const storeOrdersInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Prefer passing storeId when available to avoid race conditions
    storeId: v.optional(v.id("shopifyStores")),
    shouldScheduleAnalytics: v.optional(v.boolean()),
    orders: v.array(
      v.object({
        shopifyId: v.string(),
        orderNumber: v.string(),
        name: v.string(),
        customer: v.optional(
          v.object({
            shopifyId: v.string(),
            email: v.optional(v.string()),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
            phone: v.optional(v.string()),
            shopifyCreatedAt: v.optional(v.number()),
            shopifyUpdatedAt: v.optional(v.number()),
          })
        ),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        shopifyCreatedAt: v.number(),
        updatedAt: v.optional(v.number()),
        processedAt: v.optional(v.number()),
        closedAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        financialStatus: v.optional(v.string()),
        fulfillmentStatus: v.optional(v.string()),
        totalPrice: v.number(),
        subtotalPrice: v.number(),
        totalDiscounts: v.number(),
        totalTip: v.optional(v.number()),
        currency: v.optional(v.string()),
        totalItems: v.number(),
        totalQuantity: v.number(),
        totalWeight: v.optional(v.number()),
        tags: v.optional(v.array(v.string())),
        note: v.optional(v.string()),
        syncedAt: v.optional(v.number()),
        shippingAddress: v.optional(
          v.object({
            country: v.optional(v.string()),
            province: v.optional(v.string()),
            city: v.optional(v.string()),
            zip: v.optional(v.string()),
          })
        ),
        lineItems: v.optional(
          v.array(
            v.object({
              shopifyId: v.string(),
              shopifyProductId: v.optional(v.string()),
              shopifyVariantId: v.optional(v.string()),
              title: v.string(),
              name: v.optional(v.string()),
              sku: v.optional(v.string()),
              quantity: v.number(),
              price: v.number(),
              totalDiscount: v.number(),
              discountedPrice: v.optional(v.number()),
              fulfillableQuantity: v.optional(v.number()),
              fulfillmentStatus: v.optional(v.string()),
            })
          )
        ),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.orders || args.orders.length === 0) {
      return null;
    }

    // Resolve the store to associate with these orders
    const organizationId = args.organizationId as Id<"organizations">;
    let store: Doc<"shopifyStores"> | null = null;

    if (args.storeId) {
      // Use provided storeId when available to avoid re-query races
      store = await ctx.db.get(args.storeId);
    }

    if (!store) {
      // Fallback to active store lookup by organization
      store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization_and_active", (q) =>
          q
            .eq("organizationId", args.organizationId as Id<"organizations">)
            .eq("isActive", true)
        )
        .first();
    }

    if (!store) {
      throw new Error("No active Shopify store found");
    }

    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;

    // Step 1: Collect all unique customers from orders
    const customerDataMap = new Map<string, {
      shopifyId: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      shopifyCreatedAt?: number;
      shopifyUpdatedAt?: number;
    }>();
    const changedOrders = new Set<string>();
    const orderCreatedAtMap = new Map<string, number>();
    const customerEarliestOrderCreatedAt = new Map<string, number>();

    for (const order of args.orders) {
      if (order.customer) {
        const customerId = order.customer.shopifyId;
        const existing = customerDataMap.get(customerId);
        const nextCustomer = { ...order.customer };

        if (existing) {
          if (nextCustomer.email === undefined) nextCustomer.email = existing.email;
          if (nextCustomer.firstName === undefined) nextCustomer.firstName = existing.firstName;
          if (nextCustomer.lastName === undefined) nextCustomer.lastName = existing.lastName;
          if (nextCustomer.phone === undefined) nextCustomer.phone = existing.phone;
          if (nextCustomer.shopifyCreatedAt === undefined) {
            nextCustomer.shopifyCreatedAt = existing.shopifyCreatedAt;
          }
          if (nextCustomer.shopifyUpdatedAt === undefined) {
            nextCustomer.shopifyUpdatedAt = existing.shopifyUpdatedAt;
          }
        }

        customerDataMap.set(customerId, nextCustomer);

        const createdAt = order.shopifyCreatedAt;
        if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
          const prev = customerEarliestOrderCreatedAt.get(customerId);
          if (prev === undefined || createdAt < prev) {
            customerEarliestOrderCreatedAt.set(customerId, createdAt);
          }
        }
      }
    }

    // Step 2: Fetch only needed customers using precise index to minimize read set
    const customerShopifyIds = Array.from(customerDataMap.keys());
    const existingCustomers = new Map();

    for (const batch of chunkArray(
      customerShopifyIds,
      BULK_OPS.LOOKUP_SIZE,
    )) {
      const results = await Promise.all(
        batch.map((custShopifyId) =>
          ctx.db
            .query("shopifyCustomers")
            .withIndex("by_shopify_id_store", (q) =>
              q.eq("shopifyId", custShopifyId).eq("storeId", store!._id)
            )
            .first(),
        ),
      );

      results.forEach((existing, idx) => {
        if (existing) {
          existingCustomers.set(batch[idx]!, existing);
        }
      });
    }

    // Step 3: Prepare customer inserts/updates
    const _customersToInsert = [];
    const customerIdMap = new Map();

    for (const [shopifyId, customerData] of customerDataMap) {
      const existing = existingCustomers.get(shopifyId);
      const fallbackCustomerCreatedAt = customerEarliestOrderCreatedAt.get(shopifyId);
      const normalizedCreatedAtSource =
        typeof customerData.shopifyCreatedAt === "number" && Number.isFinite(customerData.shopifyCreatedAt)
          ? customerData.shopifyCreatedAt
          : fallbackCustomerCreatedAt;
      const resolvedCreatedAt =
        typeof normalizedCreatedAtSource === "number" && Number.isFinite(normalizedCreatedAtSource)
          ? normalizedCreatedAtSource
          : Date.now();

      const normalizedUpdatedAtSource =
        typeof customerData.shopifyUpdatedAt === "number" && Number.isFinite(customerData.shopifyUpdatedAt)
          ? customerData.shopifyUpdatedAt
          : undefined;
      const resolvedUpdatedAt = Math.max(
        resolvedCreatedAt,
        normalizedUpdatedAtSource ?? fallbackCustomerCreatedAt ?? resolvedCreatedAt,
      );

      if (existing) {
        customerIdMap.set(shopifyId, existing._id);

        const candidate = {
          email: Object.prototype.hasOwnProperty.call(customerData, "email")
            ? toOptionalString(customerData.email)
            : existing.email,
          firstName: Object.prototype.hasOwnProperty.call(customerData, "firstName")
            ? toOptionalString(customerData.firstName)
            : existing.firstName,
          lastName: Object.prototype.hasOwnProperty.call(customerData, "lastName")
            ? toOptionalString(customerData.lastName)
            : existing.lastName,
          phone: Object.prototype.hasOwnProperty.call(customerData, "phone")
            ? toOptionalString(customerData.phone)
            : existing.phone,
        };

        let needsPatch = hasCustomerWebhookChange(existing, candidate);
        const timestampUpdates: Partial<Doc<"shopifyCustomers">> = {};

        if (
          existing.shopifyCreatedAt === undefined ||
          Math.abs(existing.shopifyCreatedAt - resolvedCreatedAt) > 500
        ) {
          timestampUpdates.shopifyCreatedAt = resolvedCreatedAt;
          needsPatch = true;
        }

        const existingUpdatedAt = existing.shopifyUpdatedAt ?? existing.shopifyCreatedAt ?? 0;
        if (Math.abs(existingUpdatedAt - resolvedUpdatedAt) > 500) {
          timestampUpdates.shopifyUpdatedAt = resolvedUpdatedAt;
          needsPatch = true;
        }

        if (needsPatch) {
          await ctx.db.patch(existing._id, {
            ...candidate,
            ...timestampUpdates,
            syncedAt: Date.now(),
          });
        }
      } else {
        const now = Date.now();
        const newCustomerId = await ctx.db.insert("shopifyCustomers", {
          organizationId: args.organizationId as Id<"organizations">,
          storeId: store._id,
          shopifyId,
          email: customerData.email || undefined,
          firstName: customerData.firstName || undefined,
          lastName: customerData.lastName || undefined,
          phone: customerData.phone || undefined,
          totalSpent: 0,
          ordersCount: 0,
          shopifyCreatedAt: resolvedCreatedAt,
          shopifyUpdatedAt: resolvedUpdatedAt,
          syncedAt: now,
        });

        customerIdMap.set(shopifyId, newCustomerId);
      }
    }

    // Step 4: Fetch only needed orders by shopifyId to minimize read set
    const orderShopifyIds = args.orders.map((o) => o.shopifyId);
    const existingOrders = new Map();

    for (const batch of chunkArray(orderShopifyIds, BULK_OPS.LOOKUP_SIZE)) {
      const results = await Promise.all(
        batch.map((oid) =>
          ctx.db
            .query("shopifyOrders")
            .withIndex("by_shopify_id", (q) => q.eq("shopifyId", oid))
            .first(),
        ),
      );

      results.forEach((order, idx) => {
        if (order && order.storeId === store._id) {
          existingOrders.set(batch[idx]!, order);
        }
      });
    }

    // Step 5: Process orders and collect line items
    const orderIdMap = new Map();
    const allLineItems = [];

    for (const orderData of args.orders) {
      orderCreatedAtMap.set(orderData.shopifyId, orderData.shopifyCreatedAt);
      const customerId = orderData.customer
        ? customerIdMap.get(orderData.customer.shopifyId)
        : undefined;

      const shippingAddress = orderData.shippingAddress
        ? {
            country: toOptionalString(orderData.shippingAddress.country),
            province: toOptionalString(orderData.shippingAddress.province),
            city: toOptionalString(orderData.shippingAddress.city),
            zip: toOptionalString(orderData.shippingAddress.zip),
          }
        : undefined;

      const tags = Array.isArray(orderData.tags)
        ? orderData.tags
            .map((tag) => toOptionalString(tag))
            .filter((tag): tag is string => Boolean(tag))
        : undefined;

      const orderToStore = {
        organizationId,
        storeId: store._id,
        shopifyId: orderData.shopifyId,
        orderNumber: orderData.orderNumber,
        name: orderData.name,
        customerId: customerId || undefined,
        email: toOptionalString(orderData.email),
        phone: toOptionalString(orderData.phone),
        shopifyCreatedAt: orderData.shopifyCreatedAt,
        updatedAt: orderData.updatedAt,
        processedAt: orderData.processedAt,
        closedAt: orderData.closedAt,
        cancelledAt: orderData.cancelledAt,
        financialStatus: toOptionalString(orderData.financialStatus),
        fulfillmentStatus: toOptionalString(orderData.fulfillmentStatus),
        totalPrice: orderData.totalPrice,
        subtotalPrice: orderData.subtotalPrice,
        totalDiscounts: orderData.totalDiscounts,
        totalTip: orderData.totalTip,
        currency: toOptionalString(orderData.currency), // Store the currency code
        totalItems: orderData.totalItems,
        totalQuantity: orderData.totalQuantity,
        totalWeight: orderData.totalWeight,
        tags,
        note: toOptionalString(orderData.note),
        shippingAddress,
        syncedAt: orderData.syncedAt ?? Date.now(),
      };

      const existing = existingOrders.get(orderData.shopifyId);
      let orderId: Id<"shopifyOrders">;
      let orderWasMutated = false;

      if (existing) {
        if (hasOrderMeaningfulChange(existing, orderToStore)) {
          await ctx.db.patch(existing._id, orderToStore);
          orderWasMutated = true;
        }
        orderId = existing._id;
      } else {
        // Re-check by shopifyId to avoid duplicates in concurrent writes
        const possible = await ctx.db
          .query("shopifyOrders")
          .withIndex("by_shopify_id", (q) =>
            q.eq("shopifyId", orderData.shopifyId)
          )
          .collect();
        const existingForStore = possible.find((o) => o.storeId === store._id);

        if (existingForStore) {
          if (hasOrderMeaningfulChange(existingForStore, orderToStore)) {
            await ctx.db.patch(existingForStore._id, orderToStore);
            orderWasMutated = true;
          }
          orderId = existingForStore._id as Id<"shopifyOrders">;
        } else {
          orderId = await ctx.db.insert("shopifyOrders", orderToStore);
          orderWasMutated = true;
        }
      }

      if (orderWasMutated) {
        changedOrders.add(orderData.shopifyId);
      }

      orderIdMap.set(orderData.shopifyId, orderId);

      // Collect line items for bulk processing
      if (orderData.lineItems) {
        for (const item of orderData.lineItems) {
          allLineItems.push({
            ...item,
            orderId,
            orderShopifyId: orderData.shopifyId,
          });
        }
      }
    }

    // Step 6: Bulk process line items if any
    if (allLineItems.length > 0) {
      // Collect unique product and variant IDs
      const productShopifyIds = new Set();
      const variantShopifyIds = new Set<string>();

      for (const item of allLineItems) {
        if (item.shopifyProductId) productShopifyIds.add(item.shopifyProductId);
        if (item.shopifyVariantId) variantShopifyIds.add(item.shopifyVariantId);
      }

      // Bulk fetch products
      const productIdMap = new Map();

      if (productShopifyIds.size > 0) {
        for (const batch of chunkArray(
          Array.from(productShopifyIds),
          BULK_OPS.LOOKUP_SIZE,
        )) {
          const results = await Promise.all(
            batch.map((pid) =>
              ctx.db
                .query("shopifyProducts")
                .withIndex("by_shopify_id_store", (q) =>
                  q.eq("shopifyId", pid as string).eq("storeId", store._id),
                )
                .first()
            ),
          );

          results.forEach((product, idx) => {
            if (product) {
              productIdMap.set(batch[idx]!, product._id);
            }
          });
        }
      }

      // Bulk fetch variants
      const variantIdMap = new Map();

      if (variantShopifyIds.size > 0) {
        for (const batch of chunkArray(
          Array.from(variantShopifyIds),
          BULK_OPS.LOOKUP_SIZE,
        )) {
          const results = await Promise.all(
            batch.map((vid) =>
              ctx.db
                .query("shopifyProductVariants")
                .withIndex("by_shopify_id", (q) => q.eq("shopifyId", vid as string))
                .first()
            ),
          );

          results.forEach((variant, idx) => {
            if (variant) {
              variantIdMap.set(batch[idx]!, variant._id);
            }
          });
        }
      }

      // Bulk fetch existing line items
      const existingLineItems = new Map<string, Doc<"shopifyOrderItems">>();
      const orderIdEntries = Array.from(orderIdMap.entries());
      for (const batch of chunkArray(
        orderIdEntries,
        BULK_OPS.LOOKUP_SIZE,
      )) {
        const results = await Promise.all(
          batch.map(([, orderId]) =>
            ctx.db
              .query("shopifyOrderItems")
              .withIndex("by_order", (q) => q.eq("orderId", orderId))
              .collect()
          ),
        );

        results.forEach((items) => {
          for (const item of items) {
            existingLineItems.set(item.shopifyId, item);
          }
        });
      }

      // Process line items
      for (const item of allLineItems) {
        const totalDiscount = roundMoney(
          typeof item.totalDiscount === "number" ? item.totalDiscount : 0,
        );

        const itemToStore = {
          organizationId: args.organizationId as Id<"organizations">,
          orderId: item.orderId,
          shopifyId: item.shopifyId,
          shopifyProductId: item.shopifyProductId,
          shopifyVariantId: item.shopifyVariantId,
          productId: item.shopifyProductId
            ? productIdMap.get(item.shopifyProductId)
            : undefined,
          variantId: item.shopifyVariantId
            ? variantIdMap.get(item.shopifyVariantId)
            : undefined,
          title: toOptionalString(item.title) ?? "",
          variantTitle: toOptionalString(item.name),
          sku: toOptionalString(item.sku),
          quantity: item.quantity,
          price: item.price,
          totalDiscount,
          fulfillableQuantity: item.fulfillableQuantity ?? item.quantity ?? 0,
          fulfillmentStatus: toOptionalString(item.fulfillmentStatus),
        };

        const existingItem = existingLineItems.get(item.shopifyId);
        let itemChanged = false;

        if (existingItem && existingItem.orderId === item.orderId) {
          if (hasOrderItemMeaningfulChange(existingItem, itemToStore)) {
            await ctx.db.patch(existingItem._id, itemToStore);
            itemChanged = true;
          }
        } else {
          // Re-check to avoid duplicates in concurrent writes
          const maybeItem = await ctx.db
            .query("shopifyOrderItems")
            .withIndex("by_shopify_id", (q) =>
              q.eq("shopifyId", item.shopifyId)
            )
            .first();

          if (maybeItem) {
            if (hasOrderItemMeaningfulChange(maybeItem, itemToStore)) {
              await ctx.db.patch(maybeItem._id, itemToStore);
              itemChanged = true;
            }
          } else {
            await ctx.db.insert("shopifyOrderItems", itemToStore);
            itemChanged = true;
          }
        }

        if (itemChanged) {
          changedOrders.add(item.orderShopifyId);
        }
      }
    }

    if (changedOrders.size === 0) {
      logger.info("Skipped analytics rebuild (no order changes detected)", {
        organizationId: String(organizationId),
        ordersReceived: args.orders.length,
      });
      return null;
    }

    logger.info(`Processed ${args.orders.length} orders with bulk operations`, {
      mutatedOrders: changedOrders.size,
    });

    const affectedDates = new Set<string>();
    for (const shopifyId of changedOrders) {
      const createdAt = orderCreatedAtMap.get(shopifyId);
      if (!createdAt) continue;
      const date = msToDateString(createdAt, dateFormattingOptions);
      if (date) {
        affectedDates.add(date);
      }
    }

    const canSchedule =
      args.shouldScheduleAnalytics !== undefined
        ? args.shouldScheduleAnalytics
        : await hasCompletedInitialShopifySync(ctx, organizationId);

    if (canSchedule && affectedDates.size > 0) {
      const dates = Array.from(affectedDates);
      await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
        organizationId,
        dates,
        debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
        scope: "shopify.storeOrders",
      });
    }

    return null;
  },
});

export const storeTransactionsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    transactions: v.array(v.any()),
    shouldScheduleAnalytics: v.optional(v.boolean()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organizationId = args.organizationId as Id<"organizations">;
    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;
    const affectedDates = new Set<string>();
    const retryTransactions: Array<(typeof args.transactions)[number]> = [];
    for (const transaction of args.transactions) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", transaction.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for transaction", {
          orderId: transaction.shopifyOrderId,
          transactionId: transaction.shopifyId,
          retryCount: args.retryCount ?? 0,
        });
        retryTransactions.push(transaction);
        continue;
      }

      // Check if transaction already exists
      const existing = await ctx.db
        .query("shopifyTransactions")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", transaction.shopifyId)
        )
        .first();

      const transactionData = {
        organizationId,
        orderId: order._id,
        shopifyId: transaction.shopifyId,
        shopifyOrderId: transaction.shopifyOrderId,
        kind: transaction.kind,
        status: transaction.status,
        gateway: transaction.gateway,
        amount: transaction.amount,
        fee: transaction.fee,
        paymentId: transaction.paymentId,
        shopifyCreatedAt: transaction.shopifyCreatedAt,
        processedAt: transaction.processedAt,
      };

      let transactionMutated = false;

      if (existing) {
        if (hasTransactionMeaningfulChange(existing, transactionData)) {
          await ctx.db.patch(existing._id, transactionData);
          transactionMutated = true;
        }
      } else {
        await ctx.db.insert("shopifyTransactions", transactionData);
        transactionMutated = true;
      }

      if (transactionMutated) {
        const date = msToDateString(transaction.shopifyCreatedAt, dateFormattingOptions);
        if (date) {
          affectedDates.add(date);
        }
      }
    }

    if (retryTransactions.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.shopify.orderMutations.storeTransactionsInternal,
          {
            organizationId: args.organizationId,
            transactions: retryTransactions as any,
            shouldScheduleAnalytics: args.shouldScheduleAnalytics,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify transactions", {
          organizationId: args.organizationId,
          transactions: retryTransactions.map((tx) => tx.shopifyId),
        });
      }
    }

    if (affectedDates.size > 0) {
      const canSchedule =
        args.shouldScheduleAnalytics !== undefined
          ? args.shouldScheduleAnalytics
          : await hasCompletedInitialShopifySync(ctx, organizationId);

      if (canSchedule) {
        const dates = Array.from(affectedDates);
        await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
          organizationId,
          dates,
          debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
          scope: "shopify.storeTransactions",
        });
      }
    }

    if (affectedDates.size === 0 && retryTransactions.length === 0) {
      return null;
    }

    return null;
  },
});


export const storeRefundsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    refunds: v.array(v.any()),
    shouldScheduleAnalytics: v.optional(v.boolean()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organizationId = args.organizationId as Id<"organizations">;
    const organization = await ctx.db.get(organizationId);
    const dateFormattingOptions: MsToDateOptions | undefined = organization?.timezone
      ? { timezone: organization.timezone }
      : undefined;
    const affectedDates = new Set<string>();
    const retryRefunds: Array<(typeof args.refunds)[number]> = [];
    for (const refund of args.refunds) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", refund.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for refund", {
          orderId: refund.shopifyOrderId,
          refundId: refund.shopifyId,
          retryCount: args.retryCount ?? 0,
        });
        retryRefunds.push(refund);
        continue;
      }

      // Check if refund already exists
      const existing = await ctx.db
        .query("shopifyRefunds")
        .withIndex("by_shopify_id", (q) => q.eq("shopifyId", refund.shopifyId))
        .first();

      const refundData = {
        organizationId,
        orderId: order._id,
        shopifyId: refund.shopifyId,
        shopifyOrderId: refund.shopifyOrderId,
        note: refund.note,
        userId: refund.userId,
        totalRefunded: refund.totalRefunded,
        refundLineItems: refund.refundLineItems,
        shopifyCreatedAt: refund.shopifyCreatedAt,
        processedAt: refund.processedAt,
      };

      let refundMutated = false;

      if (existing) {
        if (hasRefundMeaningfulChange(existing, refundData)) {
          await ctx.db.patch(existing._id, refundData);
          refundMutated = true;
        }
      } else {
        await ctx.db.insert("shopifyRefunds", refundData);
        refundMutated = true;
      }

      if (refundMutated) {
        const date = msToDateString(refund.shopifyCreatedAt, dateFormattingOptions);
        if (date) {
          affectedDates.add(date);
        }
      }
    }

    if (retryRefunds.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.shopify.orderMutations.storeRefundsInternal,
          {
            organizationId: args.organizationId,
            refunds: retryRefunds as any,
            shouldScheduleAnalytics: args.shouldScheduleAnalytics,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify refunds", {
          organizationId: args.organizationId,
          refunds: retryRefunds.map((refund) => refund.shopifyId),
        });
      }
    }

    if (affectedDates.size > 0) {
      const canSchedule =
        args.shouldScheduleAnalytics !== undefined
          ? args.shouldScheduleAnalytics
          : await hasCompletedInitialShopifySync(ctx, organizationId);

      if (canSchedule) {
        const dates = Array.from(affectedDates);
        await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
          organizationId,
          dates,
          debounceMs: ANALYTICS_REBUILD_DEBOUNCE_MS,
          scope: "shopify.storeRefunds",
        });
      }
    }

    if (affectedDates.size === 0 && retryRefunds.length === 0) {
      return null;
    }

    return null;
  },
});


export const storeFulfillmentsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillments: v.array(v.any()),
    retryCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const retryFulfillments: Array<(typeof args.fulfillments)[number]> = [];
    for (const fulfillment of args.fulfillments) {
      // Find the order first
      const order = await ctx.db
        .query("shopifyOrders")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", fulfillment.shopifyOrderId)
        )
        .first();

      if (!order) {
        logger.warn("Order not found for fulfillment", {
          orderId: fulfillment.shopifyOrderId,
          fulfillmentId: fulfillment.shopifyId,
          retryCount: args.retryCount ?? 0,
        });
        retryFulfillments.push(fulfillment);
        continue;
      }

      // Check if fulfillment already exists
      const existing = await ctx.db
        .query("shopifyFulfillments")
        .withIndex("by_shopify_id", (q) =>
          q.eq("shopifyId", fulfillment.shopifyId)
        )
        .first();

      const trackingNumbers =
        toStringArray(fulfillment.trackingNumbers) ??
        toStringArray(existing?.trackingNumbers) ??
        [];
      const trackingUrls =
        toStringArray(fulfillment.trackingUrls) ??
        toStringArray(existing?.trackingUrls) ??
        [];

      const fulfillmentData = {
        organizationId: args.organizationId as Id<"organizations">,
        orderId: order._id,
        shopifyId: fulfillment.shopifyId,
        shopifyOrderId: fulfillment.shopifyOrderId,
        status: fulfillment.status,
        shipmentStatus: toOptionalString(fulfillment.shipmentStatus),
        trackingCompany: toOptionalString(fulfillment.trackingCompany),
        trackingNumbers,
        trackingUrls,
        locationId: toOptionalString(fulfillment.locationId),
        service: toOptionalString(fulfillment.service),
        lineItems: fulfillment.lineItems,
        shopifyCreatedAt: fulfillment.shopifyCreatedAt,
        shopifyUpdatedAt: fulfillment.shopifyUpdatedAt,
        syncedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, fulfillmentData);
      } else {
        await ctx.db.insert("shopifyFulfillments", fulfillmentData);
      }
    }

    if (retryFulfillments.length > 0) {
      const attempt = (args.retryCount ?? 0) + 1;
      if (attempt <= ORDER_WEBHOOK_MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          ORDER_WEBHOOK_RETRY_DELAY_MS,
          internal.shopify.orderMutations.storeFulfillmentsInternal,
          {
            organizationId: args.organizationId,
            fulfillments: retryFulfillments as any,
            retryCount: attempt,
          },
        );
      } else {
        logger.error("Exceeded retry attempts for Shopify fulfillments", {
          organizationId: args.organizationId,
          fulfillments: retryFulfillments.map((fulfillment) => fulfillment.shopifyId),
        });
      }
    }

    return null;
  },
});

/**
 * Upsert a customer from webhook payload (minimal fields)
 */

export const updateOrderStatusInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    orderId: v.string(),
    fulfillmentStatus: v.optional(v.string()),
    financialStatus: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.orderId))
      .first();

    if (order) {
      const updates: {
        updatedAt: number;
        fulfillmentStatus?: string;
        financialStatus?: string;
      } = { updatedAt: Date.now() };

      if (args.fulfillmentStatus)
        updates.fulfillmentStatus = args.fulfillmentStatus;
      if (args.financialStatus) updates.financialStatus = args.financialStatus;

      await ctx.db.patch(order._id, updates);
    }

    return null;
  },
});

export const deleteOrderByShopifyIdInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();
    if (!order) return null;

    const items = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);

    const txs = await ctx.db
      .query("shopifyTransactions")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const t of txs) await ctx.db.delete(t._id);

    const ref = await ctx.db
      .query("shopifyRefunds")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const r of ref) await ctx.db.delete(r._id);

    const f = await ctx.db
      .query("shopifyFulfillments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const ff of f) await ctx.db.delete(ff._id);

    await ctx.db.delete(order._id);
    return null;
  },
});

export const storeFulfillmentInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fulfillment: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyFulfillments")
      .withIndex("by_shopify_id", (q) =>
        q.eq("shopifyId", args.fulfillment.shopifyId)
      )
      .first();

    if (!existing) {
      await (ctx.db.insert as any)("shopifyFulfillments", {
        ...args.fulfillment,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});
