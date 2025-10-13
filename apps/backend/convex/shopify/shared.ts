import { createSimpleLogger } from "../../libs/logging/simple";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ProductDocMap = Map<string, Doc<"shopifyProducts">>;
type VariantDocMap = Map<string, Doc<"shopifyProductVariants">>;

export const logger = createSimpleLogger("Shopify");

export const BULK_OPS = {
  INSERT_SIZE: 100,
  UPDATE_SIZE: 50,
  LOOKUP_SIZE: 200,
} as const;

export const ORDER_WEBHOOK_RETRY_DELAY_MS = 5_000;
export const ORDER_WEBHOOK_MAX_RETRIES = 5;
export const ANALYTICS_REBUILD_DEBOUNCE_MS = 10_000;

export type ContextWithDb = {
  db?: QueryCtx["db"] | MutationCtx["db"];
  runQuery?: MutationCtx["runQuery"];
};

export function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (values.length === 0) return [];

  const size = Math.max(1, chunkSize);
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export function toUniqueStringArray(ids: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const value of ids) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    seen.add(trimmed);
  }
  return Array.from(seen);
}

export async function fetchExistingProductsByShopifyIds(
  ctx: MutationCtx,
  storeId: Id<"shopifyStores">,
  ids: Iterable<string>,
): Promise<ProductDocMap> {
  const result: ProductDocMap = new Map();
  const targets = toUniqueStringArray(ids);

  if (targets.length === 0) {
    return result;
  }

  for (const batch of chunkArray(targets, BULK_OPS.LOOKUP_SIZE)) {
    const matches = await Promise.all(
      batch.map((shopifyId) =>
        ctx.db
          .query("shopifyProducts")
          .withIndex("by_shopify_id_store", (q) =>
            q.eq("shopifyId", shopifyId).eq("storeId", storeId),
          )
          .first(),
      ),
    );

    matches.forEach((doc, index) => {
      const shopifyId = batch[index]!;
      if (doc) {
        result.set(shopifyId, doc);
      }
    });
  }

  return result;
}

export async function fetchExistingVariantsByShopifyIds(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  ids: Iterable<string>,
): Promise<VariantDocMap> {
  const result: VariantDocMap = new Map();
  const targets = toUniqueStringArray(ids);

  if (targets.length === 0) {
    return result;
  }

  for (const batch of chunkArray(targets, BULK_OPS.LOOKUP_SIZE)) {
    const matches = await Promise.all(
      batch.map((shopifyId) =>
        ctx.db
          .query("shopifyProductVariants")
          .withIndex("by_organization_shopify_id", (q) =>
            q.eq("organizationId", organizationId).eq("shopifyId", shopifyId),
          )
          .first(),
      ),
    );

    matches.forEach((doc, index) => {
      const shopifyId = batch[index]!;
      if (doc) {
        result.set(shopifyId, doc);
      }
    });
  }

  return result;
}
