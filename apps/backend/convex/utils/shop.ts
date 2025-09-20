// Utilities for handling Shopify shop domains consistently
// Normalize to a canonical form: lowercase, no protocol, no trailing slash
export function normalizeShopDomain(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

