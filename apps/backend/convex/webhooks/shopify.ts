import { SHOPIFY_WEBHOOK_TOPICS } from "../../libs/integrations";
import { createSimpleLogger } from "../../libs/logging/simple";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { WebhookUtils } from "../core/integrationBase";
import {
  toNum,
  toMoney,
  toMs as toTs,
  toStringArray,
} from "../utils/shopify";
import { optionalEnv, requireEnv } from "../utils/env";
import type { Id } from "../_generated/dataModel";
import { msToDateString, type MsToDateOptions } from "../utils/date";
import { hasCompletedInitialShopifySync } from "../shopify/status";

const logger = createSimpleLogger("Webhooks.Shopify");
const SHOPIFY_API_SECRET = requireEnv("SHOPIFY_API_SECRET");
const LOG_WEBHOOKS_ENABLED = optionalEnv("LOG_WEBHOOKS") === "1";

// Removed unused priority helper (incorrect reference and not used)

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (typeof value === "number") return String(value);

  return undefined;
};

const scheduleAnalyticsRebuild = async (
  ctx: any,
  organizationId: Id<"organizations">,
  dates: (string | null | undefined)[],
  scope: string,
) => {
  const normalized = dates
    .map((date) => (date ? String(date) : ""))
    .filter((date): date is string => Boolean(date));

  const deduped = Array.from(new Set(normalized));

  if (deduped.length === 0) {
    return;
  }

  await ctx.runMutation(internal.engine.analytics.enqueueDailyRebuildRequests, {
    organizationId,
    dates: deduped,
    debounceMs: 10_000,
    scope,
  });
};

const safeSerialize = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

const normalizeError = (
  error: unknown,
): { error: Error; context: Record<string, unknown> } => {
  if (error instanceof Error) {
    return { error, context: {} };
  }

  const rawError = safeSerialize(error);
  return {
    error: new Error(rawError),
    context: {
      rawError,
      errorType: typeof error,
    },
  };
};

/**
 * Shopify Webhook HTTP Handler (fast path)
 * - Verify HMAC
 * - Idempotency via receipt table
 * - Inline topic handling with lightweight analytics update
 * - Optional debug path to enqueue full processor when SHOPIFY_WEBHOOK_DEBUG=1
 */

// Use shared WebhookUtils.verifyHMAC to avoid duplication

// Main webhook handler
export const shopifyWebhook = httpAction(async (ctx, request) => {
  const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestStart = Date.now();

  try {
    // Get webhook headers
    const topic = request.headers.get("x-shopify-topic");
    const domain = request.headers.get("x-shopify-shop-domain");
    const signature = request.headers.get("x-shopify-hmac-sha256");
    const webhookId = request.headers.get("x-shopify-webhook-id");

    // Defer logging until we resolve organizationId
    const eventId = request.headers.get("x-shopify-event-id");

    // Validate required headers
    if (!topic || !domain) {
      logger.error(
        "Missing required headers",
        undefined,
        {
          topic,
          domain,
          requestId,
        },
      );
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const isValid =
      process.env.NODE_ENV === "development" ||
      (signature
        ? await WebhookUtils.verifyHMAC(rawBody, signature, SHOPIFY_API_SECRET)
        : false);

    if (!isValid) {
      logger.error(
        "Invalid signature",
        undefined,
        {
          domain,
          requestId,
        },
      );
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse JSON payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    // Fast-path processing with idempotent receipt
    // For idempotency, prefer Event-Id (stable across retries). Fallback to Webhook-Id.
    const providerId = eventId || webhookId || "";

    // Resolve organization for this shop for analytics fanout
    type StoreDoc = {
      _id: Id<"shopifyStores">;
      organizationId: Id<"organizations">;
      isActive?: boolean;
    } & Record<string, unknown>;

    let store: StoreDoc | null = null;
    let organizationId: Id<"organizations"> | undefined = undefined;
    try {
      const fetched = await ctx.runQuery(
        internal.shopify.internalQueries.getStoreByDomain as any,
        { shopDomain: domain }
      );
      if (fetched) {
        store = fetched as StoreDoc;
        organizationId = store.organizationId;
      }
    } catch (_e) {
      store = null;
      organizationId = undefined;
    }

    // Lightweight receipt log (gated by env)
    if (LOG_WEBHOOKS_ENABLED) {
      logger.info("Webhook received", {
        at: new Date().toISOString(),
        topic,
        domain,
        organizationId: organizationId ? String(organizationId) : undefined,
      });
    }

    // Idempotency: record receipt; if exists, short-circuit
    const alreadyProcessed = await ctx.runMutation(
      internal.webhooks.processor.upsertReceipt,
      { providerWebhookId: providerId, topic, shopDomain: domain } as any,
    );

    if (alreadyProcessed?.duplicate) {
      if (LOG_WEBHOOKS_ENABLED) {
        logger.info("Webhook duplicate skipped", {
          at: new Date().toISOString(),
          topic,
          domain,
          organizationId: organizationId ? String(organizationId) : undefined,
        });
      }
      return new Response(JSON.stringify({ success: true, duplicate: true, requestId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Inline topic handling – minimal writes + analytics touch
    await handleTopicInline(ctx as any, {
      topic,
      payload,
      organizationId,
      domain,
      store,
    });

    if (LOG_WEBHOOKS_ENABLED) {
      logger.info("Webhook processed", {
        at: new Date().toISOString(),
        topic,
        domain,
        organizationId: organizationId ? String(organizationId) : undefined,
      });
    }
    return new Response(JSON.stringify({ success: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    const { error: normalizedError, context } = normalizeError(error);
    logger.error(
      "Processing error",
      normalizedError,
      {
        requestId,
        processingTime,
        ...context,
      },
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        requestId,
        processingTime,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

// Health check endpoint
export const shopifyWebhookHealth = httpAction(async () => {
  return new Response(
    JSON.stringify({
      status: "ok",
      webhook_topics: SHOPIFY_WEBHOOK_TOPICS,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});

// Inline topic dispatcher: keep lightweight and idempotent.
async function handleTopicInline(
  ctx: any,
  args: {
    topic: string;
    payload: any;
    organizationId?: Id<"organizations">;
    domain?: string;
    store?: {
      _id: Id<"shopifyStores">;
      organizationId: Id<"organizations">;
      isActive?: boolean;
    } | null;
  },
) {
  const { topic, payload, domain } = args;

  type StoreShape = {
    _id: Id<"shopifyStores">;
    organizationId: Id<"organizations">;
    isActive?: boolean;
  };

  let organizationId: Id<"organizations"> | undefined = args.organizationId;
  let store: StoreShape | null = (args.store as StoreShape | null) ?? null;

  if (!store && organizationId) {
    store = await ctx.runQuery(internal.shopify.internalQueries.getActiveStoreInternal, {
      organizationId: String(organizationId),
    });
  }

  if (!organizationId && store) {
    organizationId = store.organizationId as Id<"organizations">;
  }

  const storeIsActive = store ? store.isActive !== false : false;
  const storeId = storeIsActive
    ? (store?._id as Id<"shopifyStores"> | undefined)
    : undefined;

  let initialSyncChecked = false;
  let initialSyncComplete = false;
  const ensureInitialSyncComplete = async (): Promise<boolean> => {
    if (!organizationId) {
      return false;
    }
    if (!initialSyncChecked) {
      try {
        initialSyncComplete = await hasCompletedInitialShopifySync(ctx as any, organizationId);
      } catch (_error) {
        initialSyncComplete = false;
      }
      initialSyncChecked = true;
    }
    return initialSyncComplete;
  };

  let cachedDateOptions: MsToDateOptions | null = null;
  let dateOptionsResolved = false;
  const resolveDateOptions = async (): Promise<MsToDateOptions | undefined> => {
    if (!organizationId || dateOptionsResolved) {
      return cachedDateOptions ?? undefined;
    }

    const result = await ctx.runQuery(
      internal.core.organizations.getOrganizationTimezoneInternal,
      { organizationId },
    );
    cachedDateOptions = result?.timezone ? { timezone: result.timezone } : null;
    dateOptionsResolved = true;
    return cachedDateOptions ?? undefined;
  };

  // basic normalization helpers are in utils/shopify

  switch (topic) {
    case "orders/create":
    case "orders/paid":
    case "orders/cancelled":
    case "orders/fulfilled":
    case "orders/partially_fulfilled":
    case "orders/edited": {
      if (!organizationId || !storeId) break;
      const order = payload as any;
      const li = Array.isArray(order.line_items) ? order.line_items : [];
      const orders = [
        {
          shopifyId: String(order.id),
          orderNumber: String(order.order_number ?? order.number ?? ""),
          name: String(order.name ?? `#${order.order_number ?? ""}`),
          customer: order.customer
            ? {
                shopifyId: String(order.customer.id),
                email: toOptionalString(order.customer.email),
                firstName: toOptionalString(order.customer.first_name),
                lastName: toOptionalString(order.customer.last_name),
                phone: toOptionalString(order.customer.phone),
                shopifyCreatedAt: toTs(order.customer.created_at),
                shopifyUpdatedAt: toTs(order.customer.updated_at),
              }
            : undefined,
          email: toOptionalString(order.email),
          phone: toOptionalString(order.phone),
          shopifyCreatedAt: toNum(toTs(order.created_at) ?? Date.now()),
          updatedAt: toTs(order.updated_at),
          processedAt: toTs(order.processed_at),
          closedAt: toTs(order.closed_at),
          cancelledAt: toTs(order.cancelled_at),
          financialStatus: toOptionalString(order.financial_status),
          fulfillmentStatus: toOptionalString(order.fulfillment_status),
          totalPrice:
            toMoney(order.current_total_price_set?.shop_money?.amount) ||
            toMoney(order.total_price),
          subtotalPrice:
            toMoney(order.current_subtotal_price_set?.shop_money?.amount) ||
            toMoney(order.subtotal_price),
          totalDiscounts:
            toMoney(order.current_total_discounts_set?.shop_money?.amount) ||
            toMoney(order.total_discounts),
          totalTip: toMoney(order.total_tip_received),
          currency: order.currency,
          totalItems: li.length,
          totalQuantity: li.reduce((s: number, x: any) => s + toNum(x.quantity), 0),
          shippingAddress: order.shipping_address
            ? {
                country: toOptionalString(order.shipping_address.country),
                province: toOptionalString(order.shipping_address.province),
                city: toOptionalString(order.shipping_address.city),
                zip: toOptionalString(order.shipping_address.zip),
              }
            : undefined,
          tags: typeof order.tags === "string"
            ? (order.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
            : undefined,
          note: toOptionalString(order.note),
          lineItems: li.map((x: any) => {
            const title =
              toOptionalString(x.title) ??
              toOptionalString(x.name) ??
              "";

            return {
              shopifyId: String(x.id),
              shopifyProductId: x.product_id ? String(x.product_id) : undefined,
              shopifyVariantId: x.variant_id ? String(x.variant_id) : undefined,
              title,
              name: toOptionalString(x.name),
              sku: toOptionalString(x.sku),
              quantity: toNum(x.quantity),
              price: toMoney(x.price ?? 0),
              totalDiscount: toMoney(x.total_discount ?? 0),
              discountedPrice: toMoney(x.discounted_price ?? 0),
              fulfillableQuantity: toNum(x.fulfillable_quantity),
              fulfillmentStatus: toOptionalString(x.fulfillment_status),
            };
          }),
        },
      ];

      await ctx.runMutation(internal.shopify.orderMutations.storeOrdersInternal, {
        organizationId: organizationId,
        storeId,
        orders,
      });
      // analytics recalculation handled by storeOrdersInternal when appropriate
      break;
    }

    case "orders/delete": {
      if (!organizationId) break;
      const shopifyId = String((payload as any).id);
      const existingOrder = await ctx.runQuery(
        (internal.shopify.internalQueries as any).getOrderByShopifyIdInternal,
        {
          organizationId,
          shopifyId,
        },
      );

      await ctx.runMutation(
        internal.shopify.orderMutations.deleteOrderByShopifyIdInternal,
        { organizationId, shopifyId },
      );
      // analytics recalculation handled client-side
      const dateOptions = await resolveDateOptions();
      const deletionDate = existingOrder
        ? msToDateString(existingOrder.shopifyCreatedAt, dateOptions)
        : null;
      const canSchedule = await ensureInitialSyncComplete();
      if (deletionDate && canSchedule) {
        await scheduleAnalyticsRebuild(
          ctx,
          organizationId,
          [deletionDate],
          "shopifyWebhook.orderDelete",
        );
      }
      break;
    }

    case "products/create":
    case "products/update": {
      if (!organizationId || !storeId) break;
      const p: any = payload;
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const products = [
        {
          shopifyId: String(p.id),
          handle: toOptionalString(p.handle) ?? "",
          title: toOptionalString(p.title) ?? "",
          productType: toOptionalString(p.product_type),
          vendor: toOptionalString(p.vendor),
          status: toOptionalString(p.status) ?? "",
          featuredImage: toOptionalString(p.image?.src),
          totalInventory: variants.reduce((s: number, v: any) => s + toNum(v.inventory_quantity), 0),
          totalVariants: variants.length,
          tags: typeof p.tags === "string"
            ? p.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : Array.isArray(p.tags)
              ? p.tags.map((t: any) => String(t).trim()).filter(Boolean)
              : [],
          shopifyCreatedAt: toNum(toTs(p.created_at) ?? Date.now()),
          shopifyUpdatedAt: toNum(toTs(p.updated_at) ?? Date.now()),
          publishedAt: toTs(p.published_at),
          variants: variants.map((v: any) => {
            const title = toOptionalString(v.title) ?? "";

            return {
              shopifyId: String(v.id),
              title,
              sku: toOptionalString(v.sku),
              barcode: toOptionalString(v.barcode),
              position: Number.isFinite(toNum(v.position)) ? toNum(v.position) : 0,
              price: toMoney(v.price),
              compareAtPrice: toMoney(v.compare_at_price),
              inventoryQuantity: toNum(v.inventory_quantity),
              available: typeof v.available === "boolean" ? v.available : undefined,
              taxable: typeof v.taxable === "boolean" ? v.taxable : undefined,
              inventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : undefined,
              weight: toNum(v.weight),
              weightUnit: toOptionalString(v.weight_unit),
              option1: toOptionalString(v.option1),
              option2: toOptionalString(v.option2),
              option3: toOptionalString(v.option3),
              shopifyCreatedAt: toNum(toTs(v.created_at) ?? Date.now()),
              shopifyUpdatedAt: toNum(toTs(v.updated_at) ?? Date.now()),
            };
          }),
        },
      ];
      await ctx.runMutation(internal.shopify.productMutations.storeProductsInternal, {
        organizationId: organizationId,
        storeId,
        products,
      });
      break;
    }

    case "products/delete": {
      if (!organizationId) break;
      await ctx.runMutation(
        internal.shopify.productMutations.deleteProductByShopifyIdInternal,
        { organizationId, shopifyId: String((payload as any).id) },
      );
      break;
    }

    case "customers/create":
    case "customers/update": {
      if (!organizationId || !storeId) break;
      await ctx.runMutation(
        internal.shopify.customerMutations.upsertCustomerFromWebhook,
        { organizationId, storeId, customer: payload },
      );
      break;
    }

    case "customers/delete": {
      if (!organizationId || !storeId) break;
      // Best-effort delete by id
      const shopifyId = String((payload as any).id);
      const existing = await ctx.runQuery(
        (internal.shopify.internalQueries as any).getCustomerByShopifyIdInternal,
        {
          organizationId,
          storeId,
          shopifyId,
        },
      );
      if (existing) {
        await ctx.runMutation(
          internal.shopify.customerMutations.deleteCustomerInternal,
          {
            organizationId,
            customerId: shopifyId,
          },
        );
      }
      const canSchedule = await ensureInitialSyncComplete();
      const dateOptions = await resolveDateOptions();
      const today = msToDateString(Date.now(), dateOptions);
      if (canSchedule && today) {
        await scheduleAnalyticsRebuild(
          ctx,
          organizationId,
          [today],
          "shopifyWebhook.customerDelete",
        );
      }
      break;
    }

    case "customers/enable":
    case "customers/disable": {
      if (!organizationId) break;
      const cust: any = payload;
      const state = topic.endsWith("enable") ? "enabled" : "disabled";
      const customerId = String(cust.id ?? cust.customer?.id ?? "");
      if (!customerId) break;
      await ctx.runMutation(
        internal.shopify.customerMutations.updateCustomerStatusInternal,
        {
          organizationId: organizationId,
          customerId,
          state,
        } as any,
      );
      // No analytics rebuild needed for status toggle; daily metrics skip this data
      break;
    }

    case "refunds/create": {
      if (!organizationId) break;
      const r: any = payload;
      const refunds = [
        {
          shopifyId: String(r.id),
          shopifyOrderId: String(r.order_id),
          note: r.note,
          userId: r.user_id ? String(r.user_id) : undefined,
          totalRefunded: toMoney(r.transactions?.[0]?.amount ?? 0),
          refundLineItems: Array.isArray(r.refund_line_items)
            ? r.refund_line_items
                .map((it: any) => {
                  const rawLineItemId =
                    it.line_item?.id ?? it.line_item_id ?? it.id;
                  if (!rawLineItemId) {
                    return null;
                  }
                  return {
                    lineItemId: String(rawLineItemId),
                    quantity: toNum(it.quantity),
                    subtotal: toMoney(it.subtotal ?? 0),
                  };
                })
                .filter(
                  (
                    entry:
                      | {
                          lineItemId: string;
                          quantity: number;
                          subtotal: number;
                        }
                      | null,
                  ): entry is {
                    lineItemId: string;
                    quantity: number;
                    subtotal: number;
                  } => entry !== null,
                )
            : [],
          shopifyCreatedAt: toNum(toTs(r.created_at) ?? Date.now()),
          processedAt: toTs(r.processed_at),
        },
      ];
      await ctx.runMutation(internal.shopify.orderMutations.storeRefundsInternal, {
        organizationId: organizationId,
        refunds,
      });
      // analytics recalculation handled client-side
      const canSchedule = await ensureInitialSyncComplete();
      const dateOptions = await resolveDateOptions();
      const refundDate = msToDateString(refunds[0]?.shopifyCreatedAt, dateOptions);
      if (canSchedule && refundDate) {
        await scheduleAnalyticsRebuild(
          ctx,
          organizationId,
          [refundDate],
          "shopifyWebhook.refundCreate",
        );
      }
      break;
    }

    case "fulfillments/create": {
      if (!organizationId) break;
      const f: any = payload;
      const trackingNumbers = toStringArray(f.tracking_numbers) ?? [];
      const trackingUrls = toStringArray(f.tracking_urls) ?? [];
      const fulfillments = [
        {
          shopifyId: String(f.id),
          shopifyOrderId: String(f.order_id),
          status: f.status,
          shipmentStatus: toOptionalString(f.shipment_status),
          trackingCompany: toOptionalString(f.tracking_company),
          trackingNumbers,
          trackingUrls,
          locationId: f.location_id ? String(f.location_id) : undefined,
          service: toOptionalString(f.service),
          lineItems: Array.isArray(f.line_items)
            ? f.line_items.map((li: any) => ({ id: String(li.id), quantity: toNum(li.quantity) }))
            : [],
          shopifyCreatedAt: toNum(toTs(f.created_at) ?? Date.now()),
          shopifyUpdatedAt: toTs(f.updated_at),
        },
      ];
      await ctx.runMutation(internal.shopify.orderMutations.storeFulfillmentsInternal, {
        organizationId: organizationId,
        fulfillments,
      });
      // analytics recalculation handled client-side
      break;
    }

    case "inventory_levels/update": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.inventoryMutations.updateInventoryLevelInternal,
        {
          organizationId,
          inventoryItemId: String(p.inventory_item_id ?? ""),
          locationId: String(p.location_id ?? ""),
          available: Number(p.available ?? 0),
        } as any,
      );
      break;
    }

    case "inventory_items/create": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.inventoryMutations.createInventoryItemInternal,
        {
          organizationId,
          inventoryItemId: String(p.id ?? ""),
          sku: p.sku ? String(p.sku) : undefined,
          tracked: Boolean(p.tracked),
        } as any,
      );
      break;
    }

    case "inventory_items/update": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.inventoryMutations.updateInventoryItemInternal,
        {
          organizationId,
          inventoryItemId: String(p.id ?? ""),
          sku: p.sku ? String(p.sku) : undefined,
          tracked: Boolean(p.tracked),
        } as any,
      );
      break;
    }

    case "inventory_items/delete": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.inventoryMutations.deleteInventoryItemInternal,
        {
          organizationId,
          inventoryItemId: String(p.id ?? ""),
        } as any,
      );
      break;
    }

    case "shop/update": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.shopMutations.updateShopDetailsInternal,
        {
          organizationId,
          shopId: String(p.id ?? ""),
          domain: String(p.domain ?? p.myshopify_domain ?? ""),
          planName: String(p.plan_name ?? ""),
        } as any,
      );
      break;
    }

    case "collections/create": {
      if (!organizationId) break;
      await ctx.runMutation(internal.shopify.collectionMutations.storeCollectionInternal, {
        organizationId,
        collection: payload as any,
      } as any);
      break;
    }

    case "collections/update": {
      if (!organizationId) break;
      await ctx.runMutation(
        internal.shopify.collectionMutations.updateCollectionInternal,
        {
          organizationId,
          collection: payload as any,
        } as any,
      );
      break;
    }

    case "collections/delete": {
      if (!organizationId) break;
      const p: any = payload;
      await ctx.runMutation(
        internal.shopify.collectionMutations.deleteCollectionInternal,
        {
          organizationId,
          collectionId: String(p.id ?? ""),
        } as any,
      );
      break;
    }

    case "order_transactions/create": {
      if (!organizationId) break;
      const t: any = payload;
      const txs = [
        {
          shopifyId: String(t.id),
          shopifyOrderId: String(t.order_id ?? t.order?.id ?? ""),
          kind: String(t.kind ?? ""),
          status: String(t.status ?? ""),
          gateway: String(t.gateway ?? ""),
          amount: toMoney(t.amount ?? 0),
          fee: undefined,
          paymentId: t.payment_id ? String(t.payment_id) : undefined,
          shopifyCreatedAt: toNum(toTs(t.created_at) ?? Date.now()),
          processedAt: toTs(t.processed_at),
        },
      ];
      await ctx.runMutation(internal.shopify.orderMutations.storeTransactionsInternal, {
        organizationId: organizationId,
        transactions: txs,
      });
      // analytics recalculation handled client-side
      break;
    }

    case "app_purchases/one_time": {
      if (!organizationId) break;
      const rawPurchase: any =
        (payload as any)?.app_purchase_one_time ?? payload ?? {};
      const rawAmount = rawPurchase.amount ?? rawPurchase.price ?? 0;
      const normalizedAmount =
        typeof rawAmount === "object" && rawAmount !== null
          ? rawAmount.amount ?? rawAmount.price ?? 0
          : rawAmount;
      const amount = toMoney(normalizedAmount);
      const currency =
        (typeof rawAmount === "object" && rawAmount !== null
          ? rawAmount.currency_code ?? rawAmount.currency
          : undefined) ??
        rawPurchase.currency_code ??
        rawPurchase.currency;
      const purchaseId =
        toOptionalString(rawPurchase.admin_graphql_api_id) ??
        (rawPurchase.id !== undefined ? String(rawPurchase.id) : undefined);
      const status = toOptionalString(rawPurchase.status);

      await ctx.runMutation(internal.engine.events.emitEvent, {
        type: "billing:one_time_purchase",
        organizationId,
        category: "integration",
        metadata: {
          purchaseId,
          name: toOptionalString(rawPurchase.name),
          status,
          test: rawPurchase.test === true,
          amount,
          currency,
          payload: rawPurchase,
        },
      });
      break;
    }

    case "app/uninstalled": {
      // Use domain from header, not payload (domain is from x-shopify-shop-domain header)
      const shopDomain = domain || (payload as any)?.shop_domain || ""; // domain is passed from parent scope
      
      logger.info("Processing app/uninstalled webhook", {
        domain: shopDomain,
        organizationId: organizationId || "not found",
        payloadShopDomain: (payload as any)?.shop_domain,
      });

      let orgId = organizationId ?? (store?.organizationId as Id<"organizations"> | undefined);

      // If no organizationId, try to find it by shop domain
      if (!orgId && shopDomain) {
        try {
          const found = await ctx.runQuery(
            internal.webhooks.processor.getOrganizationIdByShopDomain as any,
            { shopDomain },
          );
          orgId = found as any;
          logger.info("Found organizationId by shop domain", {
            shopDomain,
            organizationId: orgId,
          });
        } catch (e) {
          const { error: normalizedError, context } = normalizeError(e);
          logger.error(
            "Failed to find organization by shop domain",
            normalizedError,
            {
              shopDomain,
              ...context,
            },
          );
        }
      }

      // Always attempt to mark store inactive
      if (shopDomain) {
        try {
          logger.info("Marking store as inactive", { shopDomain });
          await ctx.runMutation(
            internal.shopify.lifecycle.handleAppUninstallInternal,
            { shopDomain },
          );
        } catch (e) {
          const { error: normalizedError, context } = normalizeError(e);
          logger.error(
            "Failed to mark store inactive",
            normalizedError,
            {
              shopDomain,
              ...context,
            },
          );
        }
      }

      // Emit integration disconnected event and trigger full uninstall reset when org is known
      if (orgId && shopDomain) {
        // Emit disconnected event
        try {
          await ctx.runMutation(internal.engine.events.emitEvent, {
            type: "integration:disconnected",
            organizationId: orgId,
            metadata: { platform: "shopify" },
            category: "integration",
          });
        } catch (e) {
          const { error: normalizedError, context } = normalizeError(e);
          logger.error(
            "Failed to emit integration:disconnected event",
            normalizedError,
            {
              organizationId: orgId,
              ...context,
            },
          );
        }

        // Call the main uninstall handler to reset user state and delete data
        try {
          logger.info("Calling handleAppUninstalled to reset user state", {
            organizationId: String(orgId),
            shopDomain,
          });
          
          await ctx.runMutation(
            internal.shopify.lifecycle.handleAppUninstalled as any,
            { organizationId: String(orgId), shopDomain },
          );

          logger.info("Successfully called handleAppUninstalled", {
            organizationId: String(orgId),
            shopDomain,
          });
        } catch (e) {
          const { error: normalizedError, context } = normalizeError(e);
          logger.error(
            "Failed to call handleAppUninstalled",
            normalizedError,
            {
              organizationId: String(orgId),
              shopDomain,
              ...context,
            },
          );
        }
      } else {
        logger.warn("Cannot reset user state - missing organizationId", {
          shopDomain,
          orgId: orgId || "null",
        });
      }
      break;
    }

    // ===== Billing topics =====
    case "app_subscriptions/update": {
      if (!organizationId) break;
      // Mark onboarding hasShopifySubscription = true
      try {
        const obs = await ctx.runQuery(internal.webhooks.processor.getOnboardingByOrganization as any, {
          organizationId,
        });
        const list = Array.isArray(obs) ? obs : obs ? [obs] : [];
        await Promise.all(
          list
            .filter((r: any) => r && !r.isCompleted)
            .map((r: any) =>
              ctx.runMutation(internal.webhooks.processor.patchOnboardingById as any, {
                onboardingId: r._id,
                patch: { hasShopifySubscription: true, updatedAt: Date.now() },
              }),
            ),
        );
      } catch (_e) { void 0; }

      // Resolve plan and update billing
      const nested = (payload as any)?.app_subscription || {};
      const statusRaw = (payload as any)?.status || nested.status || "";
      const nameRaw = (payload as any)?.name || nested.name || "";
      const status = String(statusRaw).toUpperCase();
      if (!status || !nameRaw) break;

      const mapPlan = (planName: string): "free" | "starter" | "growth" | "business" => {
        const m: Record<string, "starter" | "growth" | "business"> = {
          "Starter Plan": "starter",
          "Growth Plan": "growth",
          "Business Plan": "business",
        };
        return (m[planName] as any) || "free";
      };

      const subscriptionId =
        (payload as any)?.id || nested.admin_graphql_api_id || nested.id || "";
      const currentBilling = await ctx.runQuery(
        internal.webhooks.processor.getCurrentBilling as any,
        { organizationId },
      );

      let resolvedPlan: "free" | "starter" | "growth" | "business" | null = null;
      if (status === "ACTIVE") {
        resolvedPlan = mapPlan(String(nameRaw));
      } else if (status === "CANCELLED" || status === "EXPIRED") {
        // Protect against cancel of previous subscription after upgrade
        if (
          currentBilling?.shopifyBilling?.previousSubscriptionId === subscriptionId
        ) {
          resolvedPlan = null;
        } else if (
          currentBilling?.shopifyBilling?.shopifySubscriptionId !== subscriptionId &&
          currentBilling?.shopifyBilling?.isActive
        ) {
          resolvedPlan = null; // Another sub is active; ignore
        } else {
          resolvedPlan = "free";
        }
      }

      const rawInterval =
        (payload as any)?.billing_interval ||
        nested.billing_interval ||
        nested.interval ||
        "";
      const billingCycle = /year/i.test(String(rawInterval)) ? "yearly" : undefined;

      if (resolvedPlan) {
        const currentPlan = currentBilling?.shopifyBilling?.plan || "free";
        const isUpgrade =
          resolvedPlan !== "free" && currentPlan !== resolvedPlan && status === "ACTIVE";

        await ctx.runMutation(
          internal.core.organizationBilling.updateOrganizationPlanInternalWithTracking,
          {
            organizationId,
            plan: resolvedPlan,
            shopifySubscriptionId: subscriptionId ? String(subscriptionId) : undefined,
            shopifySubscriptionStatus: (payload as any)?.status || nested.status,
            billingCycle,
            isUpgrade,
            previousSubscriptionId: isUpgrade
              ? currentBilling?.shopifyBilling?.shopifySubscriptionId
              : undefined,
          } as any,
        );

        // Trial dates
        const trialEndsOn =
          (payload as any)?.trial_ends_on ||
          nested.trial_ends_on ||
          (payload as any)?.current_period_end ||
          nested.current_period_end;
        const createdAt = (payload as any)?.created_at || nested.created_at;
        if (trialEndsOn) {
          const ts = Date.parse(String(trialEndsOn));
          if (!isNaN(ts) && ts > Date.now()) {
            await ctx.runMutation(internal.webhooks.processor.updateOrganizationTrialDates, {
              organizationId,
              trialEndDate: ts,
              trialStartDate: createdAt ? Date.parse(String(createdAt)) : undefined,
            });
          }
        }
      }
      break;
    }

    case "app_subscriptions/cancelled": {
      if (!organizationId) break;
      const nested = (payload as any)?.app_subscription || {};
      const subscriptionId =
        (payload as any)?.id || nested.admin_graphql_api_id || nested.id || "";
      const currentBilling = await ctx.runQuery(
        internal.webhooks.processor.getCurrentBilling as any,
        { organizationId },
      );

      // If cancelling current sub (and no other active), downgrade to free
      const isCurrent =
        currentBilling?.shopifyBilling?.shopifySubscriptionId === subscriptionId ||
        !currentBilling?.shopifyBilling?.isActive;
      if (isCurrent) {
        await ctx.runMutation(
          internal.core.organizationBilling.updateOrganizationPlanInternal,
          {
            organizationId,
            plan: "free",
            shopifySubscriptionId: subscriptionId ? String(subscriptionId) : undefined,
            shopifySubscriptionStatus: "CANCELLED",
          } as any,
        );
      }
      break;
    }

    case "app_subscriptions/approaching_capped_amount": {
      if (organizationId) {
        await ctx.runMutation(internal.engine.events.emitEvent, {
          type: "billing:approaching_capped_amount",
          organizationId,
          metadata: { webhookPayload: payload },
        });
      }
      break;
    }

    case "app_subscription_billing_attempts/success": {
      if (organizationId) {
        await ctx.runMutation(internal.engine.events.emitEvent, {
          type: "billing:charge_success",
          organizationId,
          metadata: { webhookPayload: payload },
        });
      }
      break;
    }

    case "app_subscription_billing_attempts/failure": {
      if (organizationId) {
        await ctx.runMutation(internal.engine.events.emitEvent, {
          type: "billing:charge_failure",
          organizationId,
          metadata: { webhookPayload: payload },
        });
      }
      break;
    }

    default:
      // No-op for unhandled topics
      break;
  }
}
