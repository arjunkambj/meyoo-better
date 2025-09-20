import "@shopify/shopify-api/adapters/web-api";
import {
  BillingInterval,
  BillingReplacementBehavior,
  LATEST_API_VERSION,
  shopifyApi,
} from "@shopify/shopify-api";

// Determine the host scheme based on the environment
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
const isLocalhost =
  appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
const hostScheme = isLocalhost ? "http" : "https";

// Extract hostname without protocol and trailing slash
const hostName = appUrl
  .replace(/https?:\/\//, "") // Remove protocol
  .replace(/\/$/, ""); // Remove trailing slash

// Parse and clean scopes, removing any whitespace
const scopesString = process.env.SHOPIFY_SCOPES || "";
const scopes = scopesString
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

// Log scopes configuration for debugging
if (process.env.SHOPIFY_WEBHOOK_DEBUG === "1") {
  console.log("[Shopify Config] Configured scopes from env:", scopes);
  console.log("[Shopify Config] Raw SHOPIFY_SCOPES env:", scopesString);
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes,
  hostName: hostName || process.env.HOST?.replace(/https?:\/\//, "") || "",
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
