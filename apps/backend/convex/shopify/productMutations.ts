
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logger } from "./shared";
import {
  BULK_OPS,
  chunkArray,
  fetchExistingProductsByShopifyIds,
  fetchExistingVariantsByShopifyIds,
} from "./shared";
import { toOptionalString } from "./processingUtils";

export const storeProductsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    // Prefer passing storeId when available to avoid race conditions
    storeId: v.optional(v.id("shopifyStores")),
    syncSessionId: v.optional(v.id("syncSessions")),
    products: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.products || args.products.length === 0) {
      return null;
    }

    // Resolve the store to associate with these products
    let store: Doc<"shopifyStores"> | null = null;

    if (args.storeId) {
      store = await ctx.db.get(args.storeId);
    }

    if (!store) {
      store = await ctx.db
        .query("shopifyStores")
        .withIndex("by_organization_and_active", (q) =>
          q
            .eq("organizationId", args.organizationId as Id<"organizations">)
            .eq("isActive", true)
        )
        .first();
    }

    if (!store || store.isActive === false) {
      logger.warn("Skipping Shopify product sync because store is inactive", {
        organizationId: String(args.organizationId),
        storeId: args.storeId,
      });

      if (args.syncSessionId) {
        try {
          await ctx.runMutation(internal.jobs.helpers.patchSyncSessionMetadata, {
            sessionId: args.syncSessionId,
            metadata: {
              stageStatus: { products: "failed" },
              lastBatchError: "Shopify store inactive or uninstalled",
              failureReason: "shopify_store_inactive",
              partialSync: true,
            } as any,
          });

          await ctx.runMutation(internal.jobs.helpers.updateSyncSession, {
            sessionId: args.syncSessionId,
            status: "failed",
            error: "Shopify store inactive or uninstalled",
            completedAt: Date.now(),
          });
        } catch (metadataError) {
          logger.warn(
            "Failed to mark sync session as failed after Shopify store uninstall",
            metadataError,
          );
        }
      }

      try {
        await ctx.runMutation(
          internal.core.onboarding.triggerMonitorIfOnboardingComplete,
          {
            organizationId: args.organizationId,
            limit: 1,
            reason: "shopify_store_inactive",
          },
        );
      } catch (monitorError) {
        logger.warn(
          "monitorInitialSyncs failed after detecting inactive Shopify store",
          monitorError,
        );
      }

      return null;
    }

    // Step 1: Bulk fetch existing products without scanning the entire collection
    const existingProducts = await fetchExistingProductsByShopifyIds(
      ctx,
      store._id,
      args.products.map((product) => product.shopifyId),
    );

    // Step 2: Collect all variants from all products
    const allVariants = [];
    const variantShopifyIds = new Set<string>();
    const productIdMap = new Map();

    // Process products and collect variants
    for (const productData of args.products) {
      const variants = productData.variants || [];

      const productToStore = {
        organizationId: args.organizationId as Id<"organizations">,
        storeId: store._id,
        shopifyId: productData.shopifyId,
        title: toOptionalString(productData.title) ?? "",
        handle: toOptionalString(productData.handle) ?? "",
        productType: toOptionalString(productData.productType),
        vendor: toOptionalString(productData.vendor),
        status: toOptionalString(productData.status) ?? "",
        featuredImage: toOptionalString(productData.featuredImage),
        tags: productData.tags,
        totalVariants: variants.length,
        totalInventory: productData.totalInventory,
        shopifyCreatedAt: productData.shopifyCreatedAt,
        shopifyUpdatedAt: productData.shopifyUpdatedAt,
        publishedAt: productData.publishedAt,
        syncedAt: Date.now(),
      };

      const existing = existingProducts.get(productData.shopifyId);
      let productId: Id<"shopifyProducts">;

      if (existing) {
        await ctx.db.patch(existing._id, productToStore);
        productId = existing._id;
      } else {
        productId = await ctx.db.insert("shopifyProducts", productToStore);
      }

      productIdMap.set(productData.shopifyId, productId);

      // Collect variants for bulk processing
      for (const variant of variants) {
        variantShopifyIds.add(variant.shopifyId);
        allVariants.push({
          ...variant,
          productId,
          shopifyProductId: productData.shopifyId,
          organizationId: args.organizationId,
        });
      }
    }

    // Step 3: Bulk fetch existing variants
    const existingVariants = await fetchExistingVariantsByShopifyIds(
      ctx,
      args.organizationId as Id<"organizations">,
      variantShopifyIds,
    );

    // Step 4: Process variants and collect inventory data
    const inventoryToStore = [];
    const variantTotalsToStore = new Map<
      Id<"shopifyProductVariants">,
      { available: number; incoming: number; committed: number }
    >();
    const touchedVariantIds = new Set<Id<"shopifyProductVariants">>();
    const variantIdMap = new Map();

    const accumulateVariantTotals = (
      variantId: Id<"shopifyProductVariants">,
      available: number,
      incoming: number,
      committed: number,
    ) => {
      const current = variantTotalsToStore.get(variantId) ?? {
        available: 0,
        incoming: 0,
        committed: 0,
      };

      current.available += available;
      current.incoming += incoming;
      current.committed += committed;

      variantTotalsToStore.set(variantId, current);
    };

    for (const variant of allVariants) {
      const variantToStore = {
        organizationId: args.organizationId as Id<"organizations">,
        productId: variant.productId,
        shopifyId: variant.shopifyId,
        shopifyProductId: variant.shopifyProductId,
        title: toOptionalString(variant.title) ?? "",
        sku: toOptionalString(variant.sku),
        barcode: toOptionalString(variant.barcode),
        position:
          typeof variant.position === "number" && Number.isFinite(variant.position)
            ? variant.position
            : 0,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryQuantity: variant.inventoryQuantity,
        available: typeof variant.available === "boolean" ? variant.available : undefined, // Add the available field
        inventoryItemId: toOptionalString(variant.inventoryItemId),
        taxable: typeof variant.taxable === "boolean" ? variant.taxable : undefined,
        weight: variant.weight,
        weightUnit: toOptionalString(variant.weightUnit),
        option1: toOptionalString(variant.option1),
        option2: toOptionalString(variant.option2),
        option3: toOptionalString(variant.option3),
        shopifyCreatedAt: variant.shopifyCreatedAt,
        shopifyUpdatedAt: variant.shopifyUpdatedAt,
      };

      const existingVariant = existingVariants.get(variant.shopifyId);
      let variantId: Id<"shopifyProductVariants">;

      if (existingVariant) {
        await ctx.db.patch(existingVariant._id, variantToStore);
        variantId = existingVariant._id;
      } else {
        variantId = await ctx.db.insert(
          "shopifyProductVariants",
          variantToStore
        );
      }

      variantIdMap.set(variant.shopifyId, variantId);

      // Collect inventory levels for this variant
      touchedVariantIds.add(variantId);

      const inventoryLevels = Array.isArray(variant.inventoryLevels)
        ? variant.inventoryLevels
        : [];

      if (inventoryLevels.length > 0) {
        for (const invLevel of inventoryLevels) {
          const available =
            typeof invLevel.available === "number" ? invLevel.available : 0;
          const incoming =
            typeof invLevel.incoming === "number" ? invLevel.incoming : 0;
          const committed =
            typeof invLevel.committed === "number" ? invLevel.committed : 0;

          inventoryToStore.push({
            organizationId: variant.organizationId,
            variantId,
            locationId: invLevel.locationId,
            available,
            incoming,
            committed,
          });

          accumulateVariantTotals(variantId, available, incoming, committed);
        }
      } else {
        const available =
          typeof variant.inventoryQuantity === "number"
            ? variant.inventoryQuantity
            : 0;
        inventoryToStore.push({
          organizationId: variant.organizationId,
          variantId,
          locationId: "default",
          available,
          incoming: 0,
          committed: 0,
        });

        accumulateVariantTotals(variantId, available, 0, 0);
      }
    }

    // Step 5: Bulk process inventory levels
    if (inventoryToStore.length > 0) {
      const inventoryKeys = inventoryToStore.map(
        (inv) => `${inv.variantId}-${inv.locationId}`
      );
      const inventoryKeySet = new Set(inventoryKeys);

      const existingInventoryMap = new Map<string, Doc<"shopifyInventory">>();
      const variantIds = Array.from(touchedVariantIds);

      if (variantIds.length > 0) {
        for (const variantChunk of chunkArray(variantIds, BULK_OPS.LOOKUP_SIZE)) {
          const chunkResults = await Promise.all(
            variantChunk.map((variantId) =>
              ctx.db
                .query("shopifyInventory")
                .withIndex("by_variant", (q) => q.eq("variantId", variantId))
                .collect()
            ),
          );

          for (const docs of chunkResults) {
            for (const doc of docs) {
              const key = `${doc.variantId}-${doc.locationId}`;
              existingInventoryMap.set(key, doc);
            }
          }
        }
      }

      for (const inventory of inventoryToStore) {
        const key = `${inventory.variantId}-${inventory.locationId}`;
        const existing = existingInventoryMap.get(key);

        const inventoryData = {
          ...inventory,
          updatedAt: Date.now(),
          syncedAt: Date.now(),
        };

        if (existing) {
          await ctx.db.patch(existing._id, inventoryData);
        } else {
          await (ctx.db.insert as any)("shopifyInventory", inventoryData);
        }
      }

      for (const [key, existing] of existingInventoryMap.entries()) {
        if (!inventoryKeySet.has(key)) {
          await ctx.db.delete(existing._id);
        }
      }
    }

    if (variantTotalsToStore.size > 0) {
      const now = Date.now();
      await Promise.all(
        Array.from(variantTotalsToStore.entries()).map(
          async ([variantId, totals]) => {
            const existingTotals = await ctx.db
              .query("shopifyInventoryTotals")
              .withIndex("by_variant", (q) => q.eq("variantId", variantId))
              .first();

            const totalPayload = {
              organizationId: args.organizationId as Id<"organizations">,
              variantId,
              available: totals.available,
              incoming: totals.incoming,
              committed: totals.committed,
              updatedAt: now,
              syncedAt: now,
            };

            if (existingTotals) {
              await ctx.db.patch(existingTotals._id, totalPayload);
            } else {
              await (ctx.db.insert as any)(
                "shopifyInventoryTotals",
                totalPayload,
              );
            }
          },
        ),
      );
    }

    logger.info(
      `Processed ${args.products.length} products with bulk operations`
    );

    return null;
  },
});

export const updateProductInternal = internalMutation({
  args: {
    organizationId: v.string(),
    product: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.product.id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.product,
        syncedAt: Date.now(),
      });
    }

    return null;
  },
});

export const deleteProductByShopifyIdInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    shopifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.shopifyId))
      .first();
    if (!product) return null;

    // Delete variants and inventory
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    for (const vdoc of variants) {
      // Delete inventory rows for this variant
      const invRows = await ctx.db
        .query("shopifyInventory")
        .withIndex("by_variant", (q) => q.eq("variantId", vdoc._id))
        .collect();
      for (const inv of invRows) await ctx.db.delete(inv._id);

      const totalsDoc = await ctx.db
        .query("shopifyInventoryTotals")
        .withIndex("by_variant", (q) => q.eq("variantId", vdoc._id))
        .first();
      if (totalsDoc) {
        await ctx.db.delete(totalsDoc._id);
      }

      await ctx.db.delete(vdoc._id);
    }

    await ctx.db.delete(product._id);
    return null;
  },
});

/**
 * Delete an order and related child records by Shopify ID
 */

export const deleteProductInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    productId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.productId))
      .first();

    if (product) {
      await ctx.db.delete(product._id);
    }

    return null;
  },
});
