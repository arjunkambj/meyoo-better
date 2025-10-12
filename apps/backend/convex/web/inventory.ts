import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import type { Doc, Id } from "../_generated/dataModel";
import { action, query, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getUserAndOrg } from "../utils/auth";
import { dateRangeValidator } from "./analyticsShared";
import {
  getRangeEndExclusiveMs,
  getRangeStartMs,
  type DateRange,
} from "../utils/analyticsSource";
import { resolveDateRangeForOrganization } from "../utils/orgDateRange";

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

const inventoryVariantValidator = v.object({
  id: v.string(),
  sku: v.string(),
  title: v.string(),
  price: v.number(),
  stock: v.number(),
  available: v.number(),
  unitsSold: v.optional(v.number()),
});

const inventoryProductValidator = v.object({
  id: v.string(),
  name: v.string(),
  sku: v.string(),
  image: v.optional(v.string()),
  category: v.string(),
  vendor: v.string(),
  stock: v.number(),
  available: v.number(),
  reorderPoint: v.number(),
  stockStatus: v.union(
    v.literal("healthy"),
    v.literal("low"),
    v.literal("critical"),
    v.literal("out"),
  ),
  price: v.number(),
  cost: v.number(),
  margin: v.number(),
  unitsSold: v.optional(v.number()),
  lastSold: v.optional(v.string()),
  periodRevenue: v.optional(v.number()),
  variants: v.optional(v.array(inventoryVariantValidator)),
  variantCount: v.number(),
  abcCategory: v.union(v.literal("A"), v.literal("B"), v.literal("C")),
});

const inventoryOverviewValidator = v.object({
  totalValue: v.number(),
  totalCOGS: v.number(),
  totalSKUs: v.number(),
  stockCoverageDays: v.number(),
  deadStock: v.number(),
});

const paginationValidator = v.object({
  page: v.number(),
  pageSize: v.number(),
  total: v.number(),
  totalPages: v.number(),
});

type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  image?: string;
  category: string;
  vendor: string;
  stock: number;
  available: number;
  reorderPoint: number;
  stockStatus: "healthy" | "low" | "critical" | "out";
  price: number;
  cost: number;
  margin: number;
  unitsSold?: number;
  periodRevenue?: number;
  lastSold?: string;
  variants?: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    stock: number;
    available: number;
    unitsSold?: number;
  }>;
  variantCount: number;
  abcCategory: "A" | "B" | "C";
};

type InventoryOverviewRow = {
  computedAt: number;
  analysisWindowDays: number;
  totalValue: number;
  totalCogs: number;
  totalSkus: number;
  stockCoverageDays: number;
  deadStock: number;
};

type InventoryProductRow = {
  productId: unknown;
  name: string;
  sku: string;
  image?: string;
  category: string;
  vendor: string;
  stock: number;
  available: number;
  reorderPoint: number;
  stockStatus: "healthy" | "low" | "critical" | "out";
  price: number;
  cost: number;
  margin: number;
  unitsSold?: number;
  periodRevenue?: number;
  lastSoldAt?: number;
  variants?: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    stock: number;
    available: number;
    unitsSold?: number;
  }>;
  variantCount: number;
  abcCategory: "A" | "B" | "C";
};

const emptyOverview = {
  totalValue: 0,
  totalCOGS: 0,
  totalSKUs: 0,
  stockCoverageDays: 0,
  deadStock: 0,
};

function decodeInventoryCursor(
  rawCursor: string | null | undefined,
): { page: number } {
  if (!rawCursor) {
    return { page: 1 };
  }

  try {
    const parsed = JSON.parse(rawCursor) as { page?: unknown };
    const value =
      typeof parsed.page === "number" && Number.isFinite(parsed.page)
        ? Math.max(1, Math.floor(parsed.page))
        : 1;
    return { page: value };
  } catch (_error) {
    return { page: 1 };
  }
}

function clampPageSize(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function toIsoString(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined || !Number.isFinite(timestamp)) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

function matchesSearch(product: InventoryProduct, term: string | null): boolean {
  if (!term) {
    return true;
  }
  const normalized = term.toLowerCase();
  return (
    product.name.toLowerCase().includes(normalized) ||
    product.sku.toLowerCase().includes(normalized) ||
    product.vendor.toLowerCase().includes(normalized) ||
    product.category.toLowerCase().includes(normalized)
  );
}

function filterByStockLevel(
  product: InventoryProduct,
  stockLevel: string | null,
): boolean {
  if (!stockLevel || stockLevel === "all") {
    return true;
  }
  return product.stockStatus === stockLevel;
}

function sortProducts(
  products: InventoryProduct[],
  sortBy: string,
  sortOrder: "asc" | "desc",
): InventoryProduct[] {
  const direction = sortOrder === "asc" ? 1 : -1;

  const score = (product: InventoryProduct): number => {
    switch (sortBy) {
      case "price":
        return product.price;
      case "cost":
        return product.cost;
      case "margin":
        return product.margin;
      case "unitsSold":
        return product.unitsSold ?? 0;
      case "reorderPoint":
        return product.reorderPoint;
      case "available":
      case "stock":
        return product.available;
      case "periodRevenue":
        return product.periodRevenue ?? 0;
      case "name":
        return Number.NaN;
      default:
        return product.available;
    }
  };

  const needsAlpha = sortBy === "name";

  const sorted = [...products].sort((a, b) => {
    if (needsAlpha) {
      return direction === 1
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }

    const aScore = score(a);
    const bScore = score(b);
    if (Number.isNaN(aScore) || Number.isNaN(bScore)) {
      return direction === 1
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    if (aScore === bScore) {
      return a.name.localeCompare(b.name);
    }
    return aScore > bScore ? direction : -direction;
  });

  return sorted;
}

const ORDER_ITEMS_BATCH_SIZE = 10;

type UnitsSoldMaps = {
  productUnits: Map<string, number>;
  variantUnits: Map<string, number>;
};

function buildVariantProductMap(
  products: InventoryProductRow[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const product of products) {
    const productId =
      typeof product.productId === "string"
        ? product.productId
        : product.productId
        ? String(product.productId)
        : null;

    if (!productId) {
      continue;
    }

    if (Array.isArray(product.variants)) {
      for (const variant of product.variants) {
        if (!variant?.id) continue;
        map.set(variant.id, productId);
      }
    }
  }

  return map;
}

async function fetchOrderItemsForOrders(
  ctx: QueryCtx,
  orderIds: Array<Id<"shopifyOrders">>,
): Promise<Array<Doc<"shopifyOrderItems">>> {
  const items: Array<Doc<"shopifyOrderItems">> = [];

  for (let index = 0; index < orderIds.length; index += ORDER_ITEMS_BATCH_SIZE) {
    const batch = orderIds.slice(index, index + ORDER_ITEMS_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((orderId) =>
        ctx.db
          .query("shopifyOrderItems")
          .withIndex("by_order", (q) => q.eq("orderId", orderId))
          .collect(),
      ),
    );

    for (const batchItems of batchResults) {
      if (batchItems.length > 0) {
        items.push(...batchItems);
      }
    }
  }

  return items;
}

async function computeUnitsSoldForRange(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  products: InventoryProductRow[],
  range: DateRange,
): Promise<UnitsSoldMaps> {
  const rangeStartMs = getRangeStartMs(range);
  const rangeEndExclusiveMs = getRangeEndExclusiveMs(range);

  const orders = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) =>
      q
        .eq("organizationId", orgId)
        .gte("shopifyCreatedAt", rangeStartMs)
        .lt("shopifyCreatedAt", rangeEndExclusiveMs),
    )
    .collect();

  if (orders.length === 0) {
    return {
      productUnits: new Map(),
      variantUnits: new Map(),
    };
  }

  const orderIds = orders.map((order) => order._id as Id<"shopifyOrders">);
  const orderItems = await fetchOrderItemsForOrders(ctx, orderIds);

  if (orderItems.length === 0) {
    return {
      productUnits: new Map(),
      variantUnits: new Map(),
    };
  }

  const variantProductMap = buildVariantProductMap(products);
  const productUnits = new Map<string, number>();
  const variantUnits = new Map<string, number>();

  for (const item of orderItems) {
    const rawQuantity = typeof item.quantity === "number" ? item.quantity : 0;
    if (rawQuantity <= 0) continue;

    const variantKey =
      item.variantId !== undefined && item.variantId !== null
        ? item.variantId.toString()
        : null;

    let productKey: string | null = null;
    if (item.productId) {
      productKey = item.productId.toString();
    } else if (variantKey) {
      productKey = variantProductMap.get(variantKey) ?? null;
    }

    if (variantKey) {
      variantUnits.set(
        variantKey,
        (variantUnits.get(variantKey) ?? 0) + rawQuantity,
      );
    }

    if (productKey) {
      productUnits.set(
        productKey,
        (productUnits.get(productKey) ?? 0) + rawQuantity,
      );
    }
  }

  return {
    productUnits,
    variantUnits,
  };
}

async function loadSnapshot(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<{ overview: InventoryOverviewRow | null; products: InventoryProductRow[] }> {
  const db = ctx.db as any;
  const overview = (await db
    .query("inventoryOverviewSummaries")
    .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
    .order("desc")
    .first()) as (InventoryOverviewRow & { computedAt: number }) | null;

  if (!overview) {
    return { overview: null, products: [] };
  }

  const products = (await db
    .query("inventoryProductSummaries")
    .withIndex("by_org_computed", (q: any) =>
      q.eq("organizationId", orgId).eq("computedAt", overview.computedAt),
    )
    .collect()) as InventoryProductRow[];

  return { overview, products };
}

function mapProduct(doc: InventoryProductRow): InventoryProduct {
  const productId =
    typeof doc.productId === "string"
      ? doc.productId
      : doc.productId
      ? String(doc.productId)
      : "unknown";

  return {
    id: productId,
    name: doc.name,
    sku: doc.sku,
    image: doc.image ?? undefined,
    category: doc.category,
    vendor: doc.vendor,
    stock: doc.stock,
    available: doc.available,
    reorderPoint: doc.reorderPoint,
    stockStatus: doc.stockStatus,
    price: doc.price,
    cost: doc.cost,
    margin: doc.margin,
    unitsSold: doc.unitsSold ?? undefined,
    periodRevenue: doc.periodRevenue ?? undefined,
    lastSold: toIsoString(doc.lastSoldAt ?? undefined),
    variants: doc.variants
      ? doc.variants.map((variant) => ({
          ...variant,
          sku: variant.sku ?? "N/A",
          title: variant.title ?? "Default",
        }))
      : undefined,
    variantCount: doc.variantCount,
    abcCategory: doc.abcCategory,
  };
}

export const getInventoryAnalytics = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    stockLevel: v.optional(v.string()),
    category: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    dateRange: v.optional(dateRangeValidator),
  },
  returns: v.object({
    overview: inventoryOverviewValidator,
    products: v.object({
      data: v.array(inventoryProductValidator),
      pagination: paginationValidator,
      hasMore: v.boolean(),
    }),
    metadata: v.object({
      computedAt: v.optional(v.number()),
      analysisWindowDays: v.optional(v.number()),
      isStale: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const fallbackPageSize = clampPageSize(args.pageSize, 50);

    if (!auth) {
      return {
        overview: emptyOverview,
        products: {
          data: [],
          pagination: {
            page: 1,
            pageSize: fallbackPageSize,
            total: 0,
            totalPages: 0,
          },
          hasMore: false,
        },
        metadata: {
          computedAt: undefined,
          analysisWindowDays: undefined,
          isStale: true,
        },
      };
    }

    const orgId = auth.orgId as Id<"organizations">;
    const { overview, products } = await loadSnapshot(ctx, orgId);

    if (!overview) {
      return {
        overview: emptyOverview,
        products: {
          data: [],
          pagination: {
            page: 1,
            pageSize: fallbackPageSize,
            total: 0,
            totalPages: 0,
          },
          hasMore: false,
        },
        metadata: {
          computedAt: undefined,
          analysisWindowDays: undefined,
          isStale: true,
        },
      };
    }

    const range = args.dateRange
      ? await resolveDateRangeForOrganization(ctx, orgId, args.dateRange)
      : null;

    const cursorState = decodeInventoryCursor(args.paginationOpts?.cursor);
    const legacyPage = args.page ?? 1;
    const pageSize = clampPageSize(
      args.paginationOpts?.numItems ?? args.pageSize,
      fallbackPageSize,
    );
    const requestedPage = args.paginationOpts
      ? cursorState.page
      : Math.max(1, Math.floor(legacyPage));

    const normalizedSearch = args.searchTerm
      ? args.searchTerm.trim().toLowerCase()
      : null;
    const normalizedCategory = args.category && args.category !== "all"
      ? args.category.trim().toLowerCase()
      : null;
    const stockLevel = args.stockLevel ?? "all";
    const rawSortBy = args.sortBy ?? "available";
    const sortBy = rawSortBy === "turnoverRate" ? "unitsSold" : rawSortBy;
    const sortOrder = args.sortOrder ?? "desc";

    const mappedProducts = products.map(mapProduct);

    if (range) {
      const { productUnits, variantUnits } = await computeUnitsSoldForRange(
        ctx,
        orgId,
        products,
        range,
      );

      for (const product of mappedProducts) {
        const unitsSold = productUnits.get(product.id) ?? 0;
        product.unitsSold = unitsSold;

        if (product.variants) {
          product.variants = product.variants.map((variant) => ({
            ...variant,
            unitsSold: variantUnits.get(variant.id) ?? 0,
          }));
        }
      }
    }

    const filtered = mappedProducts.filter((product) => {
      if (!matchesSearch(product, normalizedSearch)) {
        return false;
      }
      if (
        normalizedCategory &&
        product.category.toLowerCase() !== normalizedCategory
      ) {
        return false;
      }
      if (!filterByStockLevel(product, stockLevel)) {
        return false;
      }
      return true;
    });

    const sorted = sortProducts(filtered, sortBy, sortOrder);

    const total = sorted.length;
    const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));
    const effectivePage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const startIndex = (effectivePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageEntries = sorted.slice(startIndex, endIndex);
    const hasMore = totalPages > 0 && effectivePage < totalPages;

    const convertedOverview = {
      totalValue: overview.totalValue,
      totalCOGS: overview.totalCogs,
      totalSKUs: overview.totalSkus,
      stockCoverageDays: overview.stockCoverageDays,
      deadStock: overview.deadStock,
    };

    const isStale = Date.now() - overview.computedAt > SNAPSHOT_TTL_MS;

    return {
      overview: convertedOverview,
      products: {
        data: pageEntries,
        pagination: {
          page: effectivePage,
          pageSize,
          total,
          totalPages,
        },
        hasMore,
      },
      metadata: {
        computedAt: overview.computedAt,
        analysisWindowDays: overview.analysisWindowDays,
        isStale,
      },
    };
  },
});

const severityRank: Record<"critical" | "low" | "reorder" | "overstock", number> = {
  critical: 0,
  low: 1,
  reorder: 2,
  overstock: 3,
};

export const getStockAlerts = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        id: v.string(),
        type: v.union(
          v.literal("critical"),
          v.literal("low"),
          v.literal("reorder"),
          v.literal("overstock"),
        ),
        productName: v.string(),
        sku: v.string(),
        currentStock: v.number(),
        reorderPoint: v.optional(v.number()),
        daysUntilStockout: v.optional(v.number()),
        message: v.string(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      return null;
    }

    const orgId = auth.orgId as Id<"organizations">;
    const snapshot = await loadSnapshot(ctx, orgId);
    if (!snapshot.overview) {
      return null;
    }

    const windowDays = snapshot.overview.analysisWindowDays || 30;
    const alerts: Array<{
      id: string;
      type: "critical" | "low" | "reorder" | "overstock";
      productName: string;
      sku: string;
      currentStock: number;
      reorderPoint?: number;
      daysUntilStockout?: number;
      message: string;
    }> = [];

    for (const productRow of snapshot.products) {
      const product = mapProduct(productRow);
      const sku = product.variants?.[0]?.sku ?? product.sku ?? "N/A";
      const avgDailySales = windowDays > 0 ? (product.unitsSold ?? 0) / windowDays : 0;
      const daysUntilStockout =
        avgDailySales > 0
          ? Number(Math.max(0, product.available / avgDailySales).toFixed(1))
          : undefined;

      const pushAlert = (
        type: "critical" | "low" | "reorder" | "overstock",
        message: string,
      ) => {
        alerts.push({
          id: `${product.id}-${type}`,
          type,
          productName: product.name,
          sku,
          currentStock: product.available,
          reorderPoint: product.reorderPoint,
          daysUntilStockout,
          message,
        });
      };

      if (product.available <= 0 || product.stockStatus === "out") {
        pushAlert("critical", "Product is out of stock. Immediate reorder required.");
        continue;
      }

      if (product.stockStatus === "critical") {
        pushAlert(
          "critical",
          daysUntilStockout !== undefined
            ? `Projected stockout in ${daysUntilStockout} days at current velocity.`
            : "Inventory is critically low. Reorder now.",
        );
        continue;
      }

      if (product.stockStatus === "low") {
        pushAlert(
          "low",
          daysUntilStockout !== undefined
            ? `Inventory covers approximately ${daysUntilStockout} days of demand.`
            : "Inventory is trending low. Review replenishment plan.",
        );
        continue;
      }

      if (product.available <= product.reorderPoint) {
        pushAlert(
          "reorder",
          `Available units (${product.available}) are at or below the reorder point (${product.reorderPoint}).`,
        );
        continue;
      }

      if (avgDailySales === 0 && product.available >= 50) {
        pushAlert(
          "overstock",
          "No recent sales detected but inventory remains high. Consider promotions or markdowns.",
        );
      }
    }

    alerts.sort((a, b) => {
      const severityDiff = severityRank[a.type] - severityRank[b.type];
      if (severityDiff !== 0) return severityDiff;

      const aDays = a.daysUntilStockout ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysUntilStockout ?? Number.POSITIVE_INFINITY;
      return aDays - bDays;
    });

    const limit = args.limit ?? 10;
    return alerts.slice(0, limit);
  },
});

export const refreshInventoryAnalytics = action({
  args: {
    force: v.optional(v.boolean()),
    analysisWindowDays: v.optional(v.number()),
  },
  returns: v.object({
    skipped: v.boolean(),
    computedAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) {
      throw new ConvexError("Not authenticated");
    }

    const orgId = auth.orgId as Id<"organizations">;

    if (!args.force) {
      const metadata = (await ctx.runQuery(
        internal.engine.inventory.getInventorySnapshotMetadata,
        { organizationId: orgId },
      )) as { computedAt: number; analysisWindowDays: number } | null;

      if (
        metadata?.computedAt !== undefined &&
        Date.now() - metadata.computedAt < SNAPSHOT_TTL_MS
      ) {
        return {
          skipped: true,
          computedAt: metadata.computedAt,
        };
      }
    }

    const result = (await ctx.runMutation(
      internal.engine.inventory.rebuildInventorySnapshot,
      {
        organizationId: orgId,
        analysisWindowDays: args.analysisWindowDays,
      },
    )) as { computedAt: number };

    return {
      skipped: false,
      computedAt: result.computedAt,
    };
  },
});
