import "@shopify/shopify-api/adapters/web-api";
import {
  BillingInterval,
  BillingReplacementBehavior,
  LATEST_API_VERSION,
  shopifyApi,
} from "@shopify/shopify-api";

import { optionalEnv, requireEnv } from "@/libs/env";

// Determine the host scheme based on the environment
const NEXT_PUBLIC_APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");
const SHOPIFY_API_KEY = requireEnv("SHOPIFY_API_KEY");
const SHOPIFY_API_SECRET = requireEnv("SHOPIFY_API_SECRET");
const SHOPIFY_SCOPES = optionalEnv("SHOPIFY_SCOPES") ?? "";
const HOST = optionalEnv("HOST");
const SHOPIFY_WEBHOOK_DEBUG = optionalEnv("SHOPIFY_WEBHOOK_DEBUG") === "1";

const isLocalhost =
  NEXT_PUBLIC_APP_URL.includes("localhost") ||
  NEXT_PUBLIC_APP_URL.includes("127.0.0.1");
const hostScheme = isLocalhost ? "http" : "https";

// Extract hostname without protocol and trailing slash
const baseHostName = NEXT_PUBLIC_APP_URL.replace(/https?:\/\//, "").replace(/\/$/, "");
const fallbackHostName = HOST
  ? HOST.replace(/https?:\/\//, "").replace(/\/$/, "")
  : undefined;
const hostName = baseHostName.length > 0 ? baseHostName : fallbackHostName ?? "";

// Parse and clean scopes, removing any whitespace
const scopesString = SHOPIFY_SCOPES;
const scopes = scopesString
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

// Log scopes configuration for debugging
if (SHOPIFY_WEBHOOK_DEBUG) {
  console.log("[Shopify Config] Configured scopes from env:", scopes);
  console.log("[Shopify Config] Raw SHOPIFY_SCOPES env:", scopesString);
}

const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes,
  hostName,
  hostScheme: hostScheme as "http" | "https",
  isEmbeddedApp: false,
  apiVersion: LATEST_API_VERSION,
  webhooks: {
    // Webhooks are now handled by Convex HTTP actions
    path: "/webhook/shopify",
  },
  // Removed billing config for pure managed pricing approach
  // With managed pricing, billing is handled through Shopify Admin
  future: {
    customerAddressDefaultFix: true,
  },
});

export default shopify;
// Export resolved host data for other modules that need a reliable base URL
export const resolvedHostName = hostName;
export const resolvedHostScheme = hostScheme as "http" | "https";
// Export configured scopes for validation
export const configuredScopes = scopes;
