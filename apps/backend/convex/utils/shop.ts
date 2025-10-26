import type { Doc } from "../_generated/dataModel";
import type {
  DatabaseReader,
  DatabaseWriter,
} from "../_generated/server";

// Utilities for handling Shopify shop domains consistently
// Normalize to a canonical form: lowercase, no protocol, no trailing slash
export function normalizeShopDomain(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

type DbLike = DatabaseReader | DatabaseWriter;

/**
 * Locate a Shopify store by its canonical (normalized) domain.
 * Callers are expected to normalize domains before inserting/updating records,
 * so lookups are always indexed.
 */
export async function findShopifyStoreByDomain(
  db: DbLike,
  shopDomain: string,
): Promise<Doc<"shopifyStores"> | null> {
  const canonical = normalizeShopDomain(shopDomain);

  return db
    .query("shopifyStores")
    .withIndex("by_shop_domain", (q) => q.eq("shopDomain", canonical))
    .first();
}
