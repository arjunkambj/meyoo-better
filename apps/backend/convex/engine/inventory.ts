import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYSIS_DAYS = 30;
const DEFAULT_LEAD_TIME_DAYS = 7;
const SAFETY_STOCK_DAYS = 3;
const ORDER_ITEMS_BATCH_SIZE = 10;

type DbCtx = MutationCtx | QueryCtx;

type VariantCostSnapshot = {
  cogsPerUnit?: number;
  handlingPerUnit?: number;
  taxPercent?: number;
};

let variantCostCache: Map<string, VariantCostSnapshot> | null = null;

const toCacheKey = (id: Id<"shopifyProductVariants">): string => id.toString();

async function primeVariantCostComponents(
  ctx: DbCtx,
  orgId: Id<"organizations">,
): Promise<void> {
  const components = await ctx.db
    .query("variantCosts")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .collect();

  variantCostCache = new Map();
  for (const component of components) {
    variantCostCache.set(toCacheKey(component.variantId), {
      cogsPerUnit: component.cogsPerUnit,
      handlingPerUnit: component.handlingPerUnit,
      taxPercent: component.taxPercent,
    });
  }
}

function getCachedComponent(
  variantId: Id<"shopifyProductVariants">,
): VariantCostSnapshot | undefined {
  return variantCostCache?.get(toCacheKey(variantId));
}

function getVariantCost(variant: Doc<"shopifyProductVariants">): number {
  const snapshot = getCachedComponent(variant._id);
  if (snapshot?.cogsPerUnit !== undefined) {
    return snapshot.cogsPerUnit;
  }

  const price = typeof variant.price === "number" ? variant.price : 0;
  if (variant.compareAtPrice && variant.compareAtPrice < price) {
    return variant.compareAtPrice;
  }

  return price * 0.6;
}

const aggregateInventoryLevels = (
  levels: Array<Doc<"shopifyInventoryTotals">>,
  variants?: Array<Doc<"shopifyProductVariants">>,
): Map<
  Id<"shopifyProductVariants">,
  { available: number; incoming: number; committed: number }
> => {
  const totals = new Map<
    Id<"shopifyProductVariants">,
    { available: number; incoming: number; committed: number }
  >();

  for (const level of levels) {
    const available = typeof level.available === "number" ? level.available : 0;
    const incoming = typeof level.incoming === "number" ? level.incoming : 0;
    const committed = typeof level.committed === "number" ? level.committed : 0;

    totals.set(level.variantId, {
      available,
      incoming,
      committed,
    });
  }

  if (variants) {
    for (const variant of variants) {
      const quantity =
        typeof variant.inventoryQuantity === "number"
          ? variant.inventoryQuantity
          : 0;
      const existing = totals.get(variant._id);

      if (existing) {
        if (quantity > existing.available) {
          existing.available = quantity;
        }
      } else {
        totals.set(variant._id, {
          available: quantity,
          incoming: 0,
          committed: 0,
        });
      }
    }
  }

  return totals;
};

const normalizeDateRange = (
  range: { startDate: string; endDate: string } | undefined,
  fallbackWindowDays: number,
): { start: Date; end: Date } => {
  const now = new Date();
  const end = range?.endDate ? new Date(range.endDate) : now;
  const fallbackStart = new Date(end.getTime() - fallbackWindowDays * MS_IN_DAY);
  const start = range?.startDate
    ? new Date(range.startDate)
    : fallbackStart;

  const safeEnd = Number.isNaN(end.getTime()) ? now : end;
  const safeStart = Number.isNaN(start.getTime()) ? fallbackStart : start;

  if (safeStart.getTime() > safeEnd.getTime()) {
    return { start: safeEnd, end: safeStart };
  }

  return { start: safeStart, end: safeEnd };
};

async function fetchOrderItemsForOrders(
  ctx: DbCtx,
  orderIds: Array<Id<"shopifyOrders">>,
): Promise<Array<Doc<"shopifyOrderItems">>> {
  const items: Array<Doc<"shopifyOrderItems">> = [];

  for (let i = 0; i < orderIds.length; i += ORDER_ITEMS_BATCH_SIZE) {
    const batch = orderIds.slice(i, i + ORDER_ITEMS_BATCH_SIZE);
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

async function fetchOrdersWithItems(
  ctx: DbCtx,
  orgId: Id<"organizations">,
  start?: Date,
  end?: Date,
): Promise<{
  orders: Array<Doc<"shopifyOrders">>;
  orderItems: Array<Doc<"shopifyOrderItems">>;
}> {
  const orders = await ctx.db
    .query("shopifyOrders")
    .withIndex("by_organization_and_created", (q) => {
      if (start && end) {
        return q
          .eq("organizationId", orgId)
          .gte("shopifyCreatedAt", start.getTime())
          .lte("shopifyCreatedAt", end.getTime());
      }

      if (start) {
        return q
          .eq("organizationId", orgId)
          .gte("shopifyCreatedAt", start.getTime());
      }

      if (end) {
        return q
          .eq("organizationId", orgId)
          .lte("shopifyCreatedAt", end.getTime());
      }

      return q.eq("organizationId", orgId);
    })
    .collect();
  const orderItems = await fetchOrderItemsForOrders(
    ctx,
    orders.map((order) => order._id),
  );

  return {
    orders,
    orderItems,
  };
}

type VariantSalesStats = {
  units: number;
  revenue: number;
  cogs: number;
  lastSoldAt?: number;
};

const buildVariantSalesMap = (
  orderItems: Array<Doc<"shopifyOrderItems">>,
  orders: Array<Doc<"shopifyOrders">>,
  variantMap: Map<Id<"shopifyProductVariants">, Doc<"shopifyProductVariants">>,
): Map<Id<"shopifyProductVariants">, VariantSalesStats> => {
  const orderById = new Map<string, Doc<"shopifyOrders">>();
  orders.forEach((order) => {
    orderById.set(order._id.toString(), order);
  });

  const sales = new Map<Id<"shopifyProductVariants">, VariantSalesStats>();

  orderItems.forEach((item) => {
    if (!item.variantId) return;
    const variant = variantMap.get(item.variantId);
    if (!variant) return;

    const order = orderById.get(item.orderId.toString());
    const unitPrice =
      typeof item.price === "number" ? item.price : variant.price || 0;
    const discount =
      typeof item.totalDiscount === "number" ? item.totalDiscount : 0;
    const quantity = typeof item.quantity === "number" ? item.quantity : 0;
    const lineRevenue = Math.max(0, unitPrice * quantity - discount);
    const cost = getVariantCost(variant);

    const current = sales.get(item.variantId) || {
      units: 0,
      revenue: 0,
      cogs: 0,
    };

    current.units += quantity;
    current.revenue += lineRevenue;
    current.cogs += quantity * cost;

    if (order) {
      const soldAt = order.shopifyCreatedAt;
      if (!current.lastSoldAt || soldAt > current.lastSoldAt) {
        current.lastSoldAt = soldAt;
      }
    }

    sales.set(item.variantId, current);
  });

  return sales;
};

type ProductSalesStats = {
  units: number;
  revenue: number;
  cogs: number;
  lastSoldAt?: number;
};

const buildProductSalesMap = (
  variantSales: Map<Id<"shopifyProductVariants">, VariantSalesStats>,
  variants: Array<Doc<"shopifyProductVariants">>,
): Map<Id<"shopifyProducts">, ProductSalesStats> => {
  const productSales = new Map<Id<"shopifyProducts">, ProductSalesStats>();

  variants.forEach((variant) => {
    const stats = variantSales.get(variant._id);
    if (!stats) return;

    const current = productSales.get(variant.productId) || {
      units: 0,
      revenue: 0,
      cogs: 0,
    };

    current.units += stats.units;
    current.revenue += stats.revenue;
    current.cogs += stats.cogs;

    if (stats.lastSoldAt) {
      if (!current.lastSoldAt || stats.lastSoldAt > current.lastSoldAt) {
        current.lastSoldAt = stats.lastSoldAt;
      }
    }

    productSales.set(variant.productId, current);
  });

  return productSales;
};

const groupVariantsByProduct = (
  variants: Array<Doc<"shopifyProductVariants">>,
): Map<Id<"shopifyProducts">, Array<Doc<"shopifyProductVariants">>> => {
  const grouped = new Map<
    Id<"shopifyProducts">,
    Array<Doc<"shopifyProductVariants">>
  >();

  variants.forEach((variant) => {
    const existing = grouped.get(variant.productId);
    if (existing) {
      existing.push(variant);
    } else {
      grouped.set(variant.productId, [variant]);
    }
  });

  return grouped;
};

const assignABCCategories = (
  products: Array<Doc<"shopifyProducts">>,
  productSales: Map<Id<"shopifyProducts">, ProductSalesStats>,
): Map<Id<"shopifyProducts">, "A" | "B" | "C"> => {
  const distribution = products.map((product) => {
    const stats = productSales.get(product._id);
    return {
      id: product._id,
      revenue: stats?.revenue ?? 0,
      units: stats?.units ?? 0,
    };
  });

  const totalRevenue = distribution.reduce((sum, item) => sum + item.revenue, 0);
  const totalUnits = distribution.reduce((sum, item) => sum + item.units, 0);

  if (totalRevenue > 0) {
    distribution.sort((a, b) => b.revenue - a.revenue);
    let cumulativeRevenue = 0;
    return distribution.reduce((map, item) => {
      cumulativeRevenue += item.revenue;
      const share = cumulativeRevenue / totalRevenue;
      let category: "A" | "B" | "C";
      if (share <= 0.8) {
        category = "A";
      } else if (share <= 0.95) {
        category = "B";
      } else {
        category = "C";
      }
      map.set(item.id, category);
      return map;
    }, new Map<Id<"shopifyProducts">, "A" | "B" | "C">());
  }

  if (totalUnits > 0) {
    distribution.sort((a, b) => b.units - a.units);
    let cumulativeUnits = 0;
    return distribution.reduce((map, item) => {
      cumulativeUnits += item.units;
      const share = cumulativeUnits / totalUnits;
      let category: "A" | "B" | "C";
      if (share <= 0.8) {
        category = "A";
      } else if (share <= 0.95) {
        category = "B";
      } else {
        category = "C";
      }
      map.set(item.id, category);
      return map;
    }, new Map<Id<"shopifyProducts">, "A" | "B" | "C">());
  }

  const fallback = new Map<Id<"shopifyProducts">, "A" | "B" | "C">();
  const totalCount = Math.max(distribution.length, 1);
  distribution
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((item, index) => {
      const positionRatio = (index + 1) / totalCount;
      let category: "A" | "B" | "C";
      if (positionRatio <= 0.2) {
        category = "A";
      } else if (positionRatio <= 0.5) {
        category = "B";
      } else {
        category = "C";
      }
      fallback.set(item.id, category);
    });

  return fallback;
};

type SalesTotals = {
  units: number;
  revenue: number;
  cogs: number;
};

const computeSalesTotals = (
  items: Array<Doc<"shopifyOrderItems">>,
  variantLookup: Map<Id<"shopifyProductVariants">, Doc<"shopifyProductVariants">>,
): SalesTotals => {
  let units = 0;
  let revenue = 0;
  let cogs = 0;

  for (const item of items) {
    const quantity = typeof item.quantity === "number" ? item.quantity : 0;
    units += quantity;

    const variant = item.variantId ? variantLookup.get(item.variantId) : undefined;
    const unitPrice =
      typeof item.price === "number"
        ? item.price
        : variant?.price ?? 0;
    const discount =
      typeof item.totalDiscount === "number" ? item.totalDiscount : 0;
    const lineRevenue = Math.max(0, unitPrice * quantity - discount);
    revenue += lineRevenue;

    const unitCost = variant ? getVariantCost(variant) : unitPrice * 0.6;
    cogs += unitCost * quantity;
  }

  return { units, revenue, cogs };
};

type InventoryVariantSummary = {
  id: string;
  sku?: string;
  title?: string;
  price: number;
  stock: number;
  reserved: number;
  available: number;
};

type InventoryProductSummary = {
  id: string;
  productId: Id<"shopifyProducts">;
  name: string;
  sku: string;
  image?: string;
  category: string;
  vendor: string;
  stock: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  stockStatus: "healthy" | "low" | "critical" | "out";
  price: number;
  cost: number;
  margin: number;
  turnoverRate: number;
  unitsSold?: number;
  periodRevenue?: number;
  lastSoldAt?: number;
  abcCategory: "A" | "B" | "C";
  variantCount: number;
  variants?: InventoryVariantSummary[];
};

type InventoryOverviewSummary = {
  totalValue: number;
  totalCogs: number;
  totalSkus: number;
  stockCoverageDays: number;
  deadStock: number;
  totalUnitsInStock: number;
  totalUnitsSold: number;
  analysisWindowDays: number;
};

function classifyStockStatus(
  available: number,
  avgDailySales: number,
): "healthy" | "low" | "critical" | "out" {
  if (available <= 0) return "out";
  if (avgDailySales > 0) {
    const coverageDays = available / avgDailySales;
    if (coverageDays <= SAFETY_STOCK_DAYS) return "critical";
    if (coverageDays <= DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS)
      return "low";
    return "healthy";
  }
  if (available < 5) return "critical";
  if (available < 20) return "low";
  return "healthy";
}

function prepareInventorySummaries(
  products: Array<Doc<"shopifyProducts">>,
  variants: Array<Doc<"shopifyProductVariants">>,
  inventoryTotals: Map<
    Id<"shopifyProductVariants">,
    { available: number; incoming: number; committed: number }
  >,
  productSales: Map<Id<"shopifyProducts">, ProductSalesStats>,
  abcCategories: Map<Id<"shopifyProducts">, "A" | "B" | "C">,
  analysisDays: number,
): InventoryProductSummary[] {
  const variantsByProduct = groupVariantsByProduct(variants);

  const summaries: InventoryProductSummary[] = [];

  for (const product of products) {
    const productVariants = variantsByProduct.get(product._id) ?? [];
    let totalAvailable = 0;
    let totalReserved = 0;
    let weightedCostSum = 0;
    let weightedCostWeight = 0;

    const variantSummaries: InventoryVariantSummary[] = [];

    for (const variant of productVariants) {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      const committed = totals?.committed ?? 0;
      const stock = available + committed;
      const weight = available > 0 ? available : 1;

      totalAvailable += available;
      totalReserved += committed;
      weightedCostSum += getVariantCost(variant) * weight;
      weightedCostWeight += weight;

      variantSummaries.push({
        id: variant._id.toString(),
        sku: variant.sku || product.handle || "N/A",
        title: variant.title || "Default",
        price: variant.price || 0,
        stock,
        reserved: committed,
        available,
      });
    }

    const stats = productSales.get(product._id);
    const unitsSold = stats?.units ?? 0;
    const revenue = stats?.revenue ?? 0;
    const avgDailySales = analysisDays > 0 ? unitsSold / analysisDays : 0;
    const reorderPoint =
      avgDailySales > 0
        ? Math.max(
            1,
            Math.round(
              avgDailySales * (DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS),
            ),
          )
        : 0;

    const defaultVariant = productVariants[0];
    const price = defaultVariant?.price ?? 0;
    const cost =
      weightedCostWeight > 0
        ? weightedCostSum / weightedCostWeight
        : defaultVariant
        ? getVariantCost(defaultVariant)
        : 0;
    const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
    const turnoverRate =
      totalAvailable > 0 && analysisDays > 0
        ? Math.round(((unitsSold * (365 / analysisDays)) / totalAvailable) * 10) /
          10
        : 0;

    const stockStatus = classifyStockStatus(totalAvailable, avgDailySales);

    summaries.push({
      id: product._id.toString(),
      productId: product._id,
      name: product.title,
      sku: product.handle || defaultVariant?.sku || product.shopifyId,
      image: product.featuredImage || undefined,
      category: product.productType || "Uncategorized",
      vendor: product.vendor || "Unknown",
      stock: totalAvailable + totalReserved,
      reserved: totalReserved,
      available: totalAvailable,
      reorderPoint,
      stockStatus,
      price,
      cost,
      margin,
      turnoverRate,
      unitsSold: unitsSold || undefined,
      periodRevenue: revenue || undefined,
      lastSoldAt: stats?.lastSoldAt,
      abcCategory: abcCategories.get(product._id) ?? "C",
      variantCount: productVariants.length || 1,
      variants:
        variantSummaries.length > 1 ? variantSummaries : undefined,
    });
  }

  return summaries;
}

function countDeadStock(
  variants: Array<Doc<"shopifyProductVariants">>,
  inventoryTotals: Map<
    Id<"shopifyProductVariants">,
    { available: number; incoming: number; committed: number }
  >,
  recentOrderItems: Set<Id<"shopifyProductVariants">>,
): number {
  let deadStock = 0;
  variants.forEach((variant) => {
    const totals = inventoryTotals.get(variant._id);
    const hasStock = (totals?.available ?? 0) > 0;
    if (hasStock && !recentOrderItems.has(variant._id)) {
      deadStock += 1;
    }
  });
  return deadStock;
}

function buildOverview(
  variants: Array<Doc<"shopifyProductVariants">>,
  inventoryTotals: Map<
    Id<"shopifyProductVariants">,
    { available: number; incoming: number; committed: number }
  >,
  orderItems: Array<Doc<"shopifyOrderItems">>,
  variantLookup: Map<Id<"shopifyProductVariants">, Doc<"shopifyProductVariants">>,
  analysisDays: number,
  deadStock: number,
): InventoryOverviewSummary {
  let totalValue = 0;
  let totalCogs = 0;
  let totalUnitsInStock = 0;

  variants.forEach((variant) => {
    const totals = inventoryTotals.get(variant._id);
    const available = totals?.available ?? 0;
    const price = variant.price || 0;
    const cost = getVariantCost(variant);

    totalValue += available * price;
    totalCogs += available * cost;
    totalUnitsInStock += available;
  });

  const salesTotals = computeSalesTotals(orderItems, variantLookup);
  const avgDailyUnitsSold = analysisDays > 0 ? salesTotals.units / analysisDays : 0;
  const stockCoverageDays =
    avgDailyUnitsSold > 0
      ? Math.round(totalUnitsInStock / avgDailyUnitsSold)
      : totalUnitsInStock > 0
        ? 90
        : 0;

  return {
    totalValue,
    totalCogs,
    totalSkus: variants.length,
    stockCoverageDays,
    deadStock,
    totalUnitsInStock,
    totalUnitsSold: salesTotals.units,
    analysisWindowDays: analysisDays,
  };
}

export const getInventorySnapshotMetadata = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const latest = await db
      .query("inventoryOverviewSummaries")
      .withIndex("by_organization", (q: any) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();

    if (!latest) {
      return null;
    }

    return {
      computedAt: latest.computedAt,
      analysisWindowDays: latest.analysisWindowDays,
    };
  },
});

export const rebuildInventorySnapshot = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    analysisWindowDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = args.organizationId as Id<"organizations">;
    const analysisWindowDays = Math.max(
      1,
      Math.floor(args.analysisWindowDays ?? DEFAULT_ANALYSIS_DAYS),
    );

    const db = ctx.db as any;

    await primeVariantCostComponents(ctx, orgId);

    const [products, variants, inventoryTotalsDocs] = await Promise.all([
      ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyInventoryTotals")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
    ]);

    const inventoryTotals = aggregateInventoryLevels(inventoryTotalsDocs, variants);

    const { start, end } = normalizeDateRange(undefined, analysisWindowDays);

    const { orders, orderItems } = await fetchOrdersWithItems(ctx, orgId, start, end);

    const variantLookup = new Map<
      Id<"shopifyProductVariants">,
      Doc<"shopifyProductVariants">
    >();
    variants.forEach((variant) => {
      variantLookup.set(variant._id, variant);
    });

    const variantSales = buildVariantSalesMap(orderItems, orders, variantLookup);
    const productSales = buildProductSalesMap(variantSales, variants);
    const abcCategories = assignABCCategories(products, productSales);

    const productsSummaries = prepareInventorySummaries(
      products,
      variants,
      inventoryTotals,
      productSales,
      abcCategories,
      analysisWindowDays,
    );

    const ninetyDaysAgo = Date.now() - 90 * MS_IN_DAY;
    const recentOrdersInRange = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", orgId).gt("shopifyCreatedAt", ninetyDaysAgo),
      )
      .collect();

    const recentOrderItems =
      recentOrdersInRange.length > 0
        ? await fetchOrderItemsForOrders(
            ctx,
            recentOrdersInRange.map((order) => order._id),
          )
        : [];

    const soldVariantIds = new Set<Id<"shopifyProductVariants">>();
    for (const item of recentOrderItems) {
      if (item.variantId) {
        soldVariantIds.add(item.variantId);
      }
    }

    const deadStock = countDeadStock(variants, inventoryTotals, soldVariantIds);

    const overview = buildOverview(
      variants,
      inventoryTotals,
      orderItems,
      variantLookup,
      analysisWindowDays,
      deadStock,
    );

    const computedAt = Date.now();

    const existingProducts = (await db
      .query("inventoryProductSummaries")
      .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
      .collect()) as Array<{ _id: Id<any> }>;
    for (const doc of existingProducts) {
      await db.delete(doc._id);
    }

    const existingOverviews = (await db
      .query("inventoryOverviewSummaries")
      .withIndex("by_organization", (q: any) => q.eq("organizationId", orgId))
      .collect()) as Array<{ _id: Id<any> }>;
    for (const doc of existingOverviews) {
      await db.delete(doc._id);
    }

    await db.insert("inventoryOverviewSummaries", {
      organizationId: orgId,
      computedAt,
      analysisWindowDays: overview.analysisWindowDays,
      totalValue: overview.totalValue,
      totalCogs: overview.totalCogs,
      totalSkus: overview.totalSkus,
      stockCoverageDays: overview.stockCoverageDays,
      deadStock: overview.deadStock,
      totalUnitsInStock: overview.totalUnitsInStock,
      totalUnitsSold: overview.totalUnitsSold,
    });

    for (const product of productsSummaries) {
      await db.insert("inventoryProductSummaries", {
        organizationId: orgId,
        productId: product.productId,
        computedAt,
        name: product.name,
        sku: product.sku,
        image: product.image,
        category: product.category,
        vendor: product.vendor,
        stock: product.stock,
        reserved: product.reserved,
        available: product.available,
        reorderPoint: product.reorderPoint,
        stockStatus: product.stockStatus,
        price: product.price,
        cost: product.cost,
        margin: product.margin,
        turnoverRate: product.turnoverRate,
        unitsSold: product.unitsSold,
        periodRevenue: product.periodRevenue,
        lastSoldAt: product.lastSoldAt,
        abcCategory: product.abcCategory,
        variantCount: product.variantCount,
        variants: product.variants,
      });
    }

    return {
      computedAt,
      products: productsSummaries.length,
    };
  },
});
