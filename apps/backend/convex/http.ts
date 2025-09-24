import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { syncGoogle, syncMeta, syncShopify } from "./sync/http";
import {
  customerDataRequest,
  customerRedact,
  shopRedact,
} from "./webhooks/gdpr";
import { shopifyWebhook, shopifyWebhookHealth } from "./webhooks/shopify";
import { sendOtp } from "./emails/http";

const http = httpRouter();

// Auth routes
auth.addHttpRoutes(http);

// Shopify webhook routes
http.route({
  path: "/webhook/shopify",
  method: "POST",
  handler: shopifyWebhook,
});

http.route({
  path: "/webhook/shopify",
  method: "GET",
  handler: shopifyWebhookHealth,
});

// GDPR webhook routes
http.route({
  path: "/gdpr/customers/redact",
  method: "POST",
  handler: customerRedact,
});

http.route({
  path: "/gdpr/customers/data_request",
  method: "POST",
  handler: customerDataRequest,
});

http.route({
  path: "/gdpr/shop/redact",
  method: "POST",
  handler: shopRedact,
});

// Sync HTTP endpoints
http.route({
  path: "/sync/shopify",
  method: "POST",
  handler: syncShopify,
});

http.route({
  path: "/sync/meta",
  method: "POST",
  handler: syncMeta,
});

http.route({
  path: "/sync/google",
  method: "POST",
  handler: syncGoogle,
});

// Email endpoints
http.route({
  path: "/emails/send-otp",
  method: "POST",
  handler: sendOtp,
});

export default http;
