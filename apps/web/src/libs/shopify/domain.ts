/**
 * Normalize a Shopify shop domain to the canonical lowercase form without protocol or trailing slash.
 */
export function normalizeShopDomain(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

