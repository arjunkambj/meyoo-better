import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { WebhookUtils } from "../integrations/_base";
import { requireEnv } from "../utils/env";

const SHOPIFY_API_SECRET = requireEnv("SHOPIFY_API_SECRET");

/**
 * GDPR Webhook HTTP Handlers
 * Direct webhook processing in Convex for Shopify GDPR compliance
 */

// Use shared WebhookUtils.verifyHMAC to avoid duplication

// Customer redact handler
export const customerRedact = httpAction(async (ctx, request) => {
  const requestId = `gdpr_redact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestStart = Date.now();

  try {
    // Get webhook headers
    const topic = request.headers.get("x-shopify-topic");
    const domain = request.headers.get("x-shopify-shop-domain");
    const signature = request.headers.get("x-shopify-hmac-sha256");

    // Validate required headers
    if (!topic || !domain) {
      console.error("[GDPR Customer Redact] Missing required headers", {
        topic,
        domain,
        requestId,
      });
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Ensure correct topic
    if (topic !== "customers/redact") {
      console.error("[GDPR Customer Redact] Unexpected webhook topic", {
        expected: "customers/redact",
        received: topic,
        shop: domain,
      });
      return new Response(JSON.stringify({ error: "Invalid webhook topic" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const isValid =
      process.env.NODE_ENV === "development" ||
      (signature ? await WebhookUtils.verifyHMAC(rawBody, signature, SHOPIFY_API_SECRET) : false);

    if (!isValid) {
      console.error("[GDPR Customer Redact] Invalid signature", {
        domain,
        requestId,
      });
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

    const data = payload as any;

    // Resolve organization/store for downstream processing
    const store = domain
      ? await ctx.runQuery(
          internal.integrations.shopify.getStoreByDomain as any,
          { shopDomain: domain },
        )
      : null;
    const organizationId = store?.organizationId
      ? String(store.organizationId)
      : null;

    if (!organizationId) {
      console.warn("[GDPR Customer Redact] No store found for domain", {
        shop: domain,
        requestId,
      });
      return new Response(JSON.stringify({ success: true, requestId, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const customer = (data.customer ?? {}) as {
      id?: unknown;
      email?: string;
      phone?: string;
    };
    const ordersToRedact = Array.isArray(data.orders_to_redact)
      ? data.orders_to_redact.map((id: unknown) => String(id))
      : [];

    await ctx.runMutation(
      internal.integrations.shopify.handleGDPRRedact as any,
      {
        organizationId,
        shopDomain: domain,
        customerId: customer?.id ? String(customer.id) : "",
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        ordersToRedact,
      },
    );

    // Log without PII (GDPR minimization)
    console.log("[GDPR Customer Redact] Request received", {
      shop: domain,
      shopIdPresent: Boolean(data.shop_id),
      hasCustomer: Boolean(data.customer),
      ordersToRedactCount: Array.isArray(data.orders_to_redact)
        ? data.orders_to_redact.length
        : 0,
      requestId,
    });

    // Logging disabled: webhook logs removed for performance

    // Return success response
    return new Response(JSON.stringify({ success: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error("[GDPR Customer Redact] Processing error", error, {
      requestId,
      processingTime,
    });
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

// Customer data request handler
export const customerDataRequest = httpAction(async (ctx, request) => {
  const requestId = `gdpr_data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestStart = Date.now();

  try {
    // Get webhook headers
    const topic = request.headers.get("x-shopify-topic");
    const domain = request.headers.get("x-shopify-shop-domain");
    const signature = request.headers.get("x-shopify-hmac-sha256");

    // Validate required headers
    if (!topic || !domain) {
      console.error("[GDPR Data Request] Missing required headers", {
        topic,
        domain,
        requestId,
      });
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Ensure correct topic
    if (topic !== "customers/data_request") {
      console.error("[GDPR Data Request] Unexpected webhook topic", {
        expected: "customers/data_request",
        received: topic,
        shop: domain,
      });
      return new Response(JSON.stringify({ error: "Invalid webhook topic" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const isValid =
      process.env.NODE_ENV === "development" ||
      (signature ? await WebhookUtils.verifyHMAC(rawBody, signature, SHOPIFY_API_SECRET) : false);

    if (!isValid) {
      console.error("[GDPR Data Request] Invalid signature", {
        domain,
        requestId,
      });
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

    const data = payload as any;

    const store = domain
      ? await ctx.runQuery(
          internal.integrations.shopify.getStoreByDomain as any,
          { shopDomain: domain },
        )
      : null;
    const organizationId = store?.organizationId
      ? String(store.organizationId)
      : null;

    if (!organizationId) {
      console.warn("[GDPR Data Request] No store found for domain", {
        shop: domain,
        requestId,
      });
      return new Response(JSON.stringify({ success: true, requestId, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const customer = (data.customer ?? {}) as {
      id?: unknown;
      email?: string;
      phone?: string;
    };
    const ordersRequested = Array.isArray(data.orders_requested)
      ? data.orders_requested.map((id: unknown) => String(id))
      : [];
    const dataRequestId =
      (data.data_request?.id && String(data.data_request.id)) || "";

    await ctx.runMutation(
      internal.integrations.shopify.handleGDPRDataRequest as any,
      {
        organizationId,
        shopDomain: domain,
        customerId: customer?.id ? String(customer.id) : "",
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        ordersRequested,
        dataRequestId,
      },
    );

    // Log without PII (GDPR minimization)
    console.log("[GDPR Data Request] Request received", {
      shop: domain,
      shopIdPresent: Boolean(data.shop_id),
      hasCustomer: Boolean(data.customer),
      ordersRequestedCount: Array.isArray(data.orders_requested)
        ? data.orders_requested.length
        : 0,
      dataRequestPresent: Boolean(data.data_request?.id),
      requestId,
    });

    // Logging disabled: webhook logs removed for performance

    // Return success response
    return new Response(JSON.stringify({ success: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error("[GDPR Data Request] Processing error", error, {
      requestId,
      processingTime,
    });
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

// Shop redact handler
export const shopRedact = httpAction(async (ctx, request) => {
  const requestId = `gdpr_shop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestStart = Date.now();

  try {
    // Get webhook headers
    const topic = request.headers.get("x-shopify-topic");
    const domain = request.headers.get("x-shopify-shop-domain");
    const signature = request.headers.get("x-shopify-hmac-sha256");

    // Validate required headers
    if (!topic || !domain) {
      console.error("[GDPR Shop Redact] Missing required headers", {
        topic,
        domain,
        requestId,
      });
      return new Response(
        JSON.stringify({ error: "Missing required headers" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Ensure correct topic
    if (topic !== "shop/redact") {
      console.error("[GDPR Shop Redact] Unexpected webhook topic", {
        expected: "shop/redact",
        received: topic,
        shop: domain,
      });
      return new Response(JSON.stringify({ error: "Invalid webhook topic" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const isValid =
      process.env.NODE_ENV === "development" ||
      (signature ? await WebhookUtils.verifyHMAC(rawBody, signature, SHOPIFY_API_SECRET) : false);

    if (!isValid) {
      console.error("[GDPR Shop Redact] Invalid signature", {
        domain,
        requestId,
      });
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

    const data = payload as any;

    const store = domain
      ? await ctx.runQuery(
          internal.integrations.shopify.getStoreByDomain as any,
          { shopDomain: domain },
        )
      : null;
    const organizationId = store?.organizationId
      ? String(store.organizationId)
      : null;

    if (!organizationId) {
      console.warn("[GDPR Shop Redact] No store found for domain", {
        shop: domain,
        requestId,
      });
      return new Response(JSON.stringify({ success: true, requestId, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const shopId = data.shop_id ? String(data.shop_id) : "";

    await ctx.runMutation(
      internal.integrations.shopify.handleGDPRShopRedact as any,
      {
        organizationId,
        shopId,
        shopDomain: domain,
      },
    );

    // Log without PII (GDPR minimization)
    console.log("[GDPR Shop Redact] Request received", {
      shop: domain,
      shopIdPresent: Boolean(data.shop_id),
      shopDomain: data.shop_domain ? "present" : "missing",
      requestId,
    });

    // Logging disabled: webhook logs removed for performance

    // Return success response
    return new Response(JSON.stringify({ success: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const processingTime = Date.now() - requestStart;
    console.error("[GDPR Shop Redact] Processing error", error, {
      requestId,
      processingTime,
    });
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
