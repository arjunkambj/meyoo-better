import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { action, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";
import { api } from "../_generated/api";

/**
 * Inventory Management API
 * Provides product inventory data, stock health metrics, and ABC analysis
 */

type VariantCostSnapshot = {
  cogsPerUnit?: number;
  handlingPerUnit?: number;
  taxPercent?: number;
};

let variantCostCache: Map<string, VariantCostSnapshot> | null = null;

const toCacheKey = (id: Id<"shopifyProductVariants">): string => id.toString();

const primeVariantCostComponents = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
): Promise<void> => {
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
};

const getCachedComponent = (
  variantId: Id<"shopifyProductVariants">,
): VariantCostSnapshot | undefined => {
  return variantCostCache?.get(toCacheKey(variantId));
};

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

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYSIS_DAYS = 30;
const EXTENDED_ANALYSIS_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 7;
const SAFETY_STOCK_DAYS = 3;

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

const ORDER_ITEMS_BATCH_SIZE = 10;

const fetchOrderItemsForOrders = async (
  ctx: QueryCtx,
  orderIds: Array<Id<"shopifyOrders">>,
): Promise<Array<Doc<"shopifyOrderItems">>> => {
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
};

const fetchOrdersWithItems = async (
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  start?: Date,
  end?: Date,
): Promise<{
  orders: Array<Doc<"shopifyOrders">>;
  orderItems: Array<Doc<"shopifyOrderItems">>;
}> => {
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
  if (orders.length === 0) {
    return { orders, orderItems: [] };
  }

  const orderItems = await fetchOrderItemsForOrders(
    ctx,
    orders.map((order) => order._id),
  );

  return { orders, orderItems };
};

const getVariantCost = (variant: Doc<"shopifyProductVariants">): number => {
  const snapshot = getCachedComponent(variant._id);
  if (snapshot && typeof snapshot.cogsPerUnit === "number") {
    return snapshot.cogsPerUnit;
  }

  const price = typeof variant.price === "number" ? variant.price : 0;

  if (variant.compareAtPrice && variant.compareAtPrice < price) {
    return variant.compareAtPrice;
  }

  // Fall back to a conservative estimate when cost is unknown.
  return price * 0.6;
};

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

  // If there is no sales data yet, fall back to an even distribution by count.
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

/**
 * Get inventory overview metrics
 */
export const getInventoryOverview = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalValue: v.number(),
      totalCOGS: v.number(),
      totalSKUs: v.number(),
      totalProducts: v.number(),
      lowStockItems: v.number(),
      outOfStockItems: v.number(),
      avgTurnoverRate: v.number(),
      stockCoverageDays: v.number(),
      deadStock: v.number(),
      healthScore: v.number(),
      totalSales: v.number(),
      unitsSold: v.number(),
      averageSalePrice: v.number(),
      averageProfit: v.number(),
      changes: v.object({
        totalValue: v.number(),
        totalCOGS: v.number(),
        totalSKUs: v.number(),
        turnoverRate: v.number(),
        healthScore: v.number(),
        stockCoverage: v.number(),
        totalSales: v.number(),
        unitsSold: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const { user } = auth;
    const _orgId = auth.orgId as Id<"organizations">;

    await primeVariantCostComponents(ctx, _orgId);

    // Get all products
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    // Get all variants
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    // Get inventory levels
    const inventory = await ctx.db
      .query("shopifyInventoryTotals")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    const { start, end } = normalizeDateRange(
      args.dateRange,
      DEFAULT_ANALYSIS_DAYS,
    );
    const analysisWindowMs = Math.max(1, end.getTime() - start.getTime());
    const analysisDays = Math.max(1, Math.ceil(analysisWindowMs / MS_IN_DAY));

    // Calculate metrics
    const totalProducts = products.length;
    const totalSKUs = variants.length;

    // Calculate total inventory value, COGS, and stock distribution
    let totalValue = 0;
    let totalCOGS = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let healthyItems = 0;
    let totalUnitsInStock = 0;

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      const price = variant.price || 0;
      const cost = getVariantCost(variant);

      totalValue += available * price;
      totalCOGS += available * cost;
      totalUnitsInStock += available;

      if (available === 0) {
        outOfStockItems++;
      } else if (available < 10) {
        // Low stock threshold
        lowStockItems++;
      } else {
        healthyItems++;
      }
    });

    // Calculate health score (percentage of healthy items)
    const healthScore =
      totalSKUs > 0 ? Math.round((healthyItems / totalSKUs) * 100) : 0;

    // Calculate dead stock (products not sold in 90+ days)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // Get order items from last 90 days to check what's been sold
    const recentOrdersInRange = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .gt("shopifyCreatedAt", ninetyDaysAgo),
      )
      .collect();

    const recentOrderIds = recentOrdersInRange.map((order) => order._id);
    const recentOrderItems =
      recentOrderIds.length > 0
        ? await fetchOrderItemsForOrders(ctx, recentOrderIds)
        : [];

    const soldVariantIds = new Set<Id<"shopifyProductVariants">>();
    recentOrderItems.forEach((item) => {
      if (item.variantId) {
        soldVariantIds.add(item.variantId);
      }
    });

    // Count variants that haven't been sold and have stock
    let deadStock = 0;

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const hasStock = (totals?.available ?? 0) > 0;
      const notSold = !soldVariantIds.has(variant._id);

      if (hasStock && notSold) {
        deadStock++;
      }
    });

    const variantMap = new Map<
      Id<"shopifyProductVariants">,
      Doc<"shopifyProductVariants">
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      _orgId,
      start,
      end,
    );

    const salesTotals = computeSalesTotals(orderItems, variantMap);
    const totalSales = salesTotals.revenue;
    const unitsSold = salesTotals.units;
    const totalCOGSSold = salesTotals.cogs;
    const totalProfit = totalSales - totalCOGSSold;

    const avgDailyUnitsSold = unitsSold / analysisDays;

    const annualizationFactor = 365 / analysisDays;
    const avgTurnoverRate =
      totalCOGS > 0
        ? Math.round(
            ((totalCOGSSold * annualizationFactor) / totalCOGS) * 10,
          ) /
            10
        : 0;

    const stockCoverageDays =
      avgDailyUnitsSold > 0
        ? Math.round(totalUnitsInStock / avgDailyUnitsSold)
        : totalUnitsInStock > 0
          ? 90
          : 0;

    const averageSalePrice = orders.length > 0 ? totalSales / orders.length : 0;
    const averageProfit = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    const periodDuration = analysisWindowMs;
    const prevEndDate = new Date(start.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);

    const { orderItems: prevOrderItems } = await fetchOrdersWithItems(
      ctx,
      _orgId,
      prevStartDate,
      prevEndDate,
    );
    const prevTotals = computeSalesTotals(prevOrderItems, variantMap);
    const prevAnalysisDays = Math.max(1, Math.ceil(periodDuration / MS_IN_DAY));
    const prevAnnualizationFactor = 365 / prevAnalysisDays;
    const prevTurnoverRate =
      totalCOGS > 0
        ? Math.round(
            ((prevTotals.cogs * prevAnnualizationFactor) / totalCOGS) * 10,
          ) /
            10
        : 0;
    const prevAvgDailyUnitsSold = prevTotals.units / prevAnalysisDays;
    const prevStockCoverageDays =
      prevAvgDailyUnitsSold > 0
        ? Math.round(totalUnitsInStock / prevAvgDailyUnitsSold)
        : stockCoverageDays;

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return (
        Math.round(((current - previous) / Math.abs(previous)) * 100 * 10) / 10
      );
    };

    const changes = {
      totalValue: 0,
      totalCOGS: 0,
      totalSKUs: 0,
      turnoverRate: calculateChange(avgTurnoverRate, prevTurnoverRate),
      healthScore: 0,
      stockCoverage: calculateChange(stockCoverageDays, prevStockCoverageDays),
      totalSales: calculateChange(totalSales, prevTotals.revenue),
      unitsSold: calculateChange(unitsSold, prevTotals.units),
    };

    return {
      totalValue,
      totalCOGS,
      totalSKUs,
      totalProducts,
      lowStockItems,
      outOfStockItems,
      avgTurnoverRate,
      stockCoverageDays,
      deadStock,
      healthScore,
      totalSales,
      unitsSold,
      averageSalePrice,
      averageProfit,
      changes,
    };
  },
});

/**
 * Get paginated products list with inventory data
 */
export const getProductsList = query({
  args: {
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    stockLevel: v.optional(v.string()),
    category: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.object({
    data: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sku: v.string(),
        image: v.optional(v.string()),
        category: v.string(),
        vendor: v.string(),
        stock: v.number(),
        reserved: v.number(),
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
        turnoverRate: v.number(),
        unitsSold: v.optional(v.number()),
        lastSold: v.optional(v.string()),
        variants: v.optional(
          v.array(
            v.object({
              id: v.string(),
              sku: v.string(),
              title: v.string(),
              price: v.number(),
              stock: v.number(),
              reserved: v.number(),
              available: v.number(),
            }),
          ),
        ),
        abcCategory: v.union(v.literal("A"), v.literal("B"), v.literal("C")),
      }),
    ),
    pagination: v.object({
      page: v.number(),
      pageSize: v.number(),
      total: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth)
      return {
        data: [],
        pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      };
    const orgId = auth.orgId as Id<"organizations">;

    await primeVariantCostComponents(ctx, orgId);

    const page = args.page || 1;
    const pageSize = args.pageSize || 50;

    const [products, variants, inventory] = await Promise.all([
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

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    const { start, end } = normalizeDateRange(
      args.dateRange,
      DEFAULT_ANALYSIS_DAYS,
    );
    const analysisWindowMs = Math.max(1, end.getTime() - start.getTime());
    const analysisDays = Math.max(1, Math.ceil(analysisWindowMs / MS_IN_DAY));

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      orgId,
      start,
      end,
    );

    const variantMap = new Map<
      Id<"shopifyProductVariants">,
      Doc<"shopifyProductVariants">
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const variantsByProduct = groupVariantsByProduct(variants);

    const variantSales = buildVariantSalesMap(orderItems, orders, variantMap);
    const productSales = buildProductSalesMap(variantSales, variants);
    const abcCategories = assignABCCategories(products, productSales);

    const productsWithInventory = products.map((product) => {
      const productVariants = variantsByProduct.get(product._id) ?? [];
      let totalAvailable = 0;
      let totalReserved = 0;
      let weightedCostSum = 0;
      let weightedCostWeight = 0;

      const variantInventory = productVariants.map((variant) => {
        const totals = inventoryTotals.get(variant._id);
        const available = totals?.available ?? 0;
        const committed = totals?.committed ?? 0;
        const stock = available + committed;
        const weight = available > 0 ? available : 1;

        totalAvailable += available;
        totalReserved += committed;
        weightedCostSum += getVariantCost(variant) * weight;
        weightedCostWeight += weight;

        return {
          id: variant._id,
          sku: variant.sku || "N/A",
          title: variant.title || "Default",
          price: variant.price || 0,
          stock,
          reserved: committed,
          available,
        };
      });

      const totalStock = totalAvailable + totalReserved;

      const salesStats = productSales.get(product._id);
      const unitsSold = salesStats?.units ?? 0;
      const avgDailySales = unitsSold / analysisDays;

      const reorderPoint =
        avgDailySales > 0
          ? Math.max(
              1,
              Math.round(
                avgDailySales * (DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS),
              ),
            )
          : 0;

      const stockStatus = (() => {
        if (totalAvailable <= 0) return "out" as const;
        if (avgDailySales > 0) {
          const coverageDays = totalAvailable / avgDailySales;
          if (coverageDays <= SAFETY_STOCK_DAYS) return "critical" as const;
          if (coverageDays <= DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS)
            return "low" as const;
        } else {
          if (totalAvailable < 5) return "critical" as const;
          if (totalAvailable < 20) return "low" as const;
        }
        return "healthy" as const;
      })();

      const defaultVariant = productVariants[0];
      const price = defaultVariant?.price ?? 0;
      const cost =
        weightedCostWeight > 0
          ? weightedCostSum / weightedCostWeight
          : defaultVariant
            ? getVariantCost(defaultVariant)
            : 0;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

      const annualizationFactor = 365 / analysisDays;
      const turnoverRate =
        totalAvailable > 0
          ? Math.round(
              ((unitsSold * annualizationFactor) / totalAvailable) * 10,
            ) /
            10
          : 0;

      const lastSold =
        salesStats?.lastSoldAt != null
          ? new Date(salesStats.lastSoldAt).toISOString()
          : undefined;

      return {
        id: product._id,
        name: product.title,
        sku: defaultVariant?.sku || product.handle || "N/A",
        image: product.featuredImage,
        category: product.productType || "Uncategorized",
        vendor: product.vendor || "Unknown",
        stock: totalStock,
        reserved: totalReserved,
        available: totalAvailable,
        reorderPoint,
        stockStatus,
        price,
        cost,
        margin,
        turnoverRate,
        unitsSold,
        lastSold,
        variants: variantInventory.length > 1 ? variantInventory : undefined,
        abcCategory: abcCategories.get(product._id) ?? "C",
      };
    });

    let filteredProducts = [...productsWithInventory];

    if (args.stockLevel) {
      filteredProducts = filteredProducts.filter(
        (product) => product.stockStatus === args.stockLevel,
      );
    }

    if (args.category && args.category !== "all") {
      filteredProducts = filteredProducts.filter(
        (product) => product.abcCategory === args.category,
      );
    }

    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      filteredProducts = filteredProducts.filter((product) => {
        return (
          product.name.toLowerCase().includes(term) ||
          product.sku.toLowerCase().includes(term) ||
          product.vendor.toLowerCase().includes(term) ||
          product.category.toLowerCase().includes(term)
        );
      });
    }

    if (args.sortBy) {
      filteredProducts.sort((a, b) => {
        const sortKey = args.sortBy as keyof typeof a;
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === undefined || bVal === undefined) {
          return 0;
        }
        const order = args.sortOrder === "desc" ? -1 : 1;
        return aVal > bVal ? order : aVal < bVal ? -order : 0;
      });
    }

    const total = filteredProducts.length;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const startIndex = (safePage - 1) * pageSize;
    const paginatedData = filteredProducts.slice(
      startIndex,
      startIndex + pageSize,
    );

    return {
      data: paginatedData,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
      },
    };
  },
});

/**
 * Get stock health distribution
 */
export const getStockHealth = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      status: v.string(),
      count: v.number(),
      percentage: v.number(),
      value: v.number(),
      color: v.string(),
      icon: v.string(),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<"organizations">;

    await primeVariantCostComponents(ctx, orgId);

    // Get variants and inventory
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const inventory = await ctx.db
      .query("shopifyInventoryTotals")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    // Count by stock status
    let healthy = 0;
    let low = 0;
    let critical = 0;
    let out = 0;
    let healthyValue = 0;
    let lowValue = 0;
    let criticalValue = 0;

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      const value = available * (variant.price || 0);

      if (available === 0) {
        out++;
      } else if (available < 5) {
        critical++;
        criticalValue += value;
      } else if (available < 20) {
        low++;
        lowValue += value;
      } else {
        healthy++;
        healthyValue += value;
      }
    });

    const total = variants.length;

    return [
      {
        status: "Healthy Stock",
        count: healthy,
        percentage: total > 0 ? Math.round((healthy / total) * 100) : 0,
        value: healthyValue,
        color: "#22C55E",
        icon: "solar:check-circle-bold-duotone",
      },
      {
        status: "Low Stock",
        count: low,
        percentage: total > 0 ? Math.round((low / total) * 100) : 0,
        value: lowValue,
        color: "#F59E0B",
        icon: "solar:info-circle-bold-duotone",
      },
      {
        status: "Critical Stock",
        count: critical,
        percentage: total > 0 ? Math.round((critical / total) * 100) : 0,
        value: criticalValue,
        color: "#EF4444",
        icon: "solar:danger-triangle-bold-duotone",
      },
      {
        status: "Out of Stock",
        count: out,
        percentage: total > 0 ? Math.round((out / total) * 100) : 0,
        value: 0,
        color: "#94A3B8",
        icon: "solar:close-circle-bold-duotone",
      },
    ];
  },
});

/**
 * Get ABC analysis data
 */
export const getABCAnalysis = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      category: v.union(v.literal("A"), v.literal("B"), v.literal("C")),
      label: v.string(),
      description: v.string(),
      productCount: v.number(),
      valuePercentage: v.number(),
      volumePercentage: v.number(),
      revenue: v.number(),
      color: v.string(),
      icon: v.string(),
      recommendations: v.array(v.string()),
    }),
  ),
  handler: async (ctx, _args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<'organizations'>;

    await primeVariantCostComponents(ctx, orgId);

    const [products, variants] = await Promise.all([
      ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
    ]);

    const { start, end } = normalizeDateRange(
      _args.dateRange,
      EXTENDED_ANALYSIS_DAYS,
    );

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      orgId,
      start,
      end,
    );

    const variantMap = new Map<
      Id<'shopifyProductVariants'>,
      Doc<'shopifyProductVariants'>
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const variantSales = buildVariantSalesMap(orderItems, orders, variantMap);
    const productSales = buildProductSalesMap(variantSales, variants);
    const abcCategories = assignABCCategories(products, productSales);

    const categoryTotals: Record<"A" | "B" | "C", {
      productCount: number;
      revenue: number;
      units: number;
    }> = {
      A: { productCount: 0, revenue: 0, units: 0 },
      B: { productCount: 0, revenue: 0, units: 0 },
      C: { productCount: 0, revenue: 0, units: 0 },
    };

    products.forEach((product) => {
      const category = abcCategories.get(product._id) ?? "C";
      const stats = productSales.get(product._id);
      categoryTotals[category].productCount += 1;
      if (stats) {
        categoryTotals[category].revenue += stats.revenue;
        categoryTotals[category].units += stats.units;
      }
    });

    const totalRevenue =
      categoryTotals.A.revenue +
      categoryTotals.B.revenue +
      categoryTotals.C.revenue;
    const totalUnits =
      categoryTotals.A.units +
      categoryTotals.B.units +
      categoryTotals.C.units;

    const toPercentage = (value: number, total: number): number => {
      if (total === 0) return 0;
      return Math.round((value / total) * 1000) / 10;
    };

    return [
      {
        category: "A" as const,
        label: "High Value",
        description: "Top performers contributing the largest share of revenue",
        productCount: categoryTotals.A.productCount,
        valuePercentage: toPercentage(categoryTotals.A.revenue, totalRevenue),
        volumePercentage: toPercentage(categoryTotals.A.units, totalUnits),
        revenue: Math.round(categoryTotals.A.revenue),
        color: "success",
        icon: "solar:star-bold-duotone",
        recommendations: [
          "Maintain optimal stock levels",
          "Monitor closely for stockouts",
          "Prioritize in warehouse layout",
        ],
      },
      {
        category: "B" as const,
        label: "Medium Value",
        description: "Steady movers with moderate revenue impact",
        productCount: categoryTotals.B.productCount,
        valuePercentage: toPercentage(categoryTotals.B.revenue, totalRevenue),
        volumePercentage: toPercentage(categoryTotals.B.units, totalUnits),
        revenue: Math.round(categoryTotals.B.revenue),
        color: "warning",
        icon: "solar:square-bold-duotone",
        recommendations: [
          "Review pricing and bundling opportunities",
          "Optimize reorder points",
          "Balance stock with forecasted demand",
        ],
      },
      {
        category: "C" as const,
        label: "Low Value",
        description: "Long-tail items with limited contribution",
        productCount: categoryTotals.C.productCount,
        valuePercentage: toPercentage(categoryTotals.C.revenue, totalRevenue),
        volumePercentage: toPercentage(categoryTotals.C.units, totalUnits),
        revenue: Math.round(categoryTotals.C.revenue),
        color: "default",
        icon: "solar:circle-bold-duotone",
        recommendations: [
          "Evaluate for discontinuation",
          "Reduce stock levels or run promotions",
          "Focus on targeted marketing",
        ],
      },
    ];
  },
});

/**
 * Get stock alerts
 */
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
    if (!auth) return null;
    const orgId = auth.orgId as Id<'organizations'>;

    await primeVariantCostComponents(ctx, orgId);

    const [products, variants, inventory] = await Promise.all([
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

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    const { start, end } = normalizeDateRange(undefined, DEFAULT_ANALYSIS_DAYS);
    const analysisWindowMs = Math.max(1, end.getTime() - start.getTime());
    const analysisDays = Math.max(1, Math.ceil(analysisWindowMs / MS_IN_DAY));

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      orgId,
      start,
      end,
    );

    const variantMap = new Map<
      Id<'shopifyProductVariants'>,
      Doc<'shopifyProductVariants'>
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const variantSales = buildVariantSalesMap(orderItems, orders, variantMap);
    const productMap = new Map<Id<'shopifyProducts'>, Doc<'shopifyProducts'>>();
    products.forEach((product) => {
      productMap.set(product._id, product);
    });

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

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      const product = productMap.get(variant.productId);
      const productName = product?.title || variant.title || "Unnamed Product";
      const sku = variant.sku || product?.handle || "N/A";
      const salesStats = variantSales.get(variant._id);
      const unitsSold = salesStats?.units ?? 0;
      const avgDailySales = unitsSold / analysisDays;
      const reorderPoint =
        avgDailySales > 0
          ? Math.max(
              1,
              Math.round(
                avgDailySales * (DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS),
              ),
            )
          : 0;
      const coverageDays = avgDailySales > 0 ? available / avgDailySales : Infinity;
      const daysUntilStockout =
        avgDailySales > 0
          ? Number(Math.max(0, coverageDays).toFixed(1))
          : undefined;

      if (available <= 0) {
        alerts.push({
          id: `${variant._id}-out`,
          type: "critical",
          productName,
          sku,
          currentStock: 0,
          reorderPoint,
          daysUntilStockout: 0,
          message: "Product is out of stock. Immediate reorder required.",
        });
        return;
      }

      if (avgDailySales > 0) {
        if (coverageDays <= SAFETY_STOCK_DAYS) {
          alerts.push({
            id: `${variant._id}-critical`,
            type: "critical",
            productName,
            sku,
            currentStock: available,
            reorderPoint,
            daysUntilStockout,
            message: `Projected stockout in ${daysUntilStockout} days at current velocity.`,
          });
          return;
        }

        if (coverageDays <= DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS) {
          alerts.push({
            id: `${variant._id}-low`,
            type: "low",
            productName,
            sku,
            currentStock: available,
            reorderPoint,
            daysUntilStockout,
            message: `Inventory covers approximately ${daysUntilStockout} days. Plan a restock.`,
          });
          return;
        }

        if (available <= reorderPoint) {
          alerts.push({
            id: `${variant._id}-reorder`,
            type: "reorder",
            productName,
            sku,
            currentStock: available,
            reorderPoint,
            daysUntilStockout,
            message: `Available units (${available}) are below the reorder point (${reorderPoint}).`,
          });
          return;
        }

        const generousCover =
          (DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS) * 3;
        if (coverageDays >= generousCover) {
          alerts.push({
            id: `${variant._id}-overstock`,
            type: "overstock",
            productName,
            sku,
            currentStock: available,
            reorderPoint,
            daysUntilStockout,
            message: `Stock covers roughly ${daysUntilStockout} days of demand. Consider slowing replenishment.`,
          });
        }

        return;
      }

      // No sales in the analysis window
      if (available >= 50) {
        alerts.push({
          id: `${variant._id}-idle`,
          type: "overstock",
          productName,
          sku,
          currentStock: available,
          reorderPoint,
          message: "No recent sales detected but inventory remains high. Evaluate for markdown or promotions.",
        });
      }
    });

    const severityRank: Record<
      "critical" | "low" | "reorder" | "overstock",
      number
    > = {
      critical: 0,
      low: 1,
      reorder: 2,
      overstock: 3,
    };

    alerts.sort((a, b) => {
      const severityDiff = severityRank[a.type] - severityRank[b.type];
      if (severityDiff !== 0) return severityDiff;

      const aDays = a.daysUntilStockout ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysUntilStockout ?? Number.POSITIVE_INFINITY;
      return aDays - bDays;
    });

    const limit = args.limit || 10;
    return alerts.slice(0, limit);
  },
});

/**
 * Get top performing products
 */
export const getTopPerformers = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    best: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sku: v.string(),
        image: v.optional(v.string()),
        metric: v.number(),
        change: v.number(),
        units: v.number(),
        revenue: v.number(),
        trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      }),
    ),
    worst: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sku: v.string(),
        image: v.optional(v.string()),
        metric: v.number(),
        change: v.number(),
        units: v.number(),
        revenue: v.number(),
        trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      }),
    ),
    trending: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        sku: v.string(),
        image: v.optional(v.string()),
        metric: v.number(),
        change: v.number(),
        units: v.number(),
        revenue: v.number(),
        trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return { best: [], worst: [], trending: [] };

    const limit = args.limit || 3;

    const orgId = auth.orgId as Id<'organizations'>;

    await primeVariantCostComponents(ctx, orgId);

    const [products, variants] = await Promise.all([
      ctx.db
        .query("shopifyProducts")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
    ]);

    const { start, end } = normalizeDateRange(
      args.dateRange,
      DEFAULT_ANALYSIS_DAYS,
    );
    const periodDurationMs = Math.max(MS_IN_DAY, end.getTime() - start.getTime());

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      orgId,
      start,
      end,
    );

    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodDurationMs);
    const { orders: prevOrders, orderItems: prevOrderItems } =
      await fetchOrdersWithItems(ctx, orgId, prevStart, prevEnd);

    const variantMap = new Map<
      Id<'shopifyProductVariants'>,
      Doc<'shopifyProductVariants'>
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const currentVariantSales = buildVariantSalesMap(
      orderItems,
      orders,
      variantMap,
    );
    const previousVariantSales = buildVariantSalesMap(
      prevOrderItems,
      prevOrders,
      variantMap,
    );

    const currentProductSales = buildProductSalesMap(
      currentVariantSales,
      variants,
    );
    const previousProductSales = buildProductSalesMap(
      previousVariantSales,
      variants,
    );

    const performanceData = products.map((product) => {
      const current = currentProductSales.get(product._id) || {
        units: 0,
        revenue: 0,
        cogs: 0,
      };
      const previous = previousProductSales.get(product._id) || {
        units: 0,
        revenue: 0,
        cogs: 0,
      };

      const variant = variants.find((v) => v.productId === product._id);

      const change =
        previous.units > 0
          ? Number(
              (((current.units - previous.units) / previous.units) * 100).toFixed(1),
            )
          : current.units > 0
            ? 100
            : 0;

      type Trend = "up" | "down" | "stable";
      const trend: Trend = change > 0 ? "up" : change < 0 ? "down" : "stable";

      return {
        id: String(product._id),
        name: product.title,
        sku: variant?.sku || product.handle || "N/A",
        image: product.featuredImage,
        metric: current.units,
        change,
        units: current.units,
        revenue: current.revenue,
        trend,
      };
    });

    const best = [...performanceData]
      .sort((a, b) => b.units - a.units)
      .slice(0, limit);

    const worst = [...performanceData]
      .sort((a, b) => a.units - b.units)
      .slice(0, limit);

    const trending = [...performanceData]
      .sort((a, b) => b.change - a.change)
      .slice(0, limit);

    return { best, worst, trending };
  },
});

/**
 * Get stock movement data (inbound/outbound)
 */
export const getStockMovement = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    periods: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      period: v.string(),
      inbound: v.number(),
      outbound: v.number(),
      netMovement: v.number(),
      velocity: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];

    const orgId = auth.orgId as Id<'organizations'>;

    await primeVariantCostComponents(ctx, orgId);

    const periods = args.periods || 7;
    const endDate = args.dateRange?.endDate
      ? new Date(args.dateRange.endDate)
      : new Date();
    const startDate = args.dateRange?.startDate
      ? new Date(args.dateRange.startDate)
      : new Date(endDate.getTime() - (periods - 1) * MS_IN_DAY);
    startDate.setHours(0, 0, 0, 0);

    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", orgId)
          .gte("shopifyCreatedAt", startDate.getTime())
          .lte("shopifyCreatedAt", endDate.getTime()),
      )
      .collect();

    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", orgId),
      )
      .collect();

    const inventory = await ctx.db
      .query("shopifyInventoryTotals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", orgId),
      )
      .collect();

    const itemsByOrder = new Map<string, Array<Doc<'shopifyOrderItems'>>>();
    orderItems.forEach((item) => {
      const key = item.orderId.toString();
      const existing = itemsByOrder.get(key);
      if (existing) {
        existing.push(item);
      } else {
        itemsByOrder.set(key, [item]);
      }
    });

    const periodEntries: Array<{
      key: string;
      label: string;
      start: Date;
      end: Date;
    }> = [];
    const movementData = new Map<
      string,
      { label: string; inbound: number; outbound: number; orders: number }
    >();

    for (let i = 0; i < periods; i++) {
      const currentDate = new Date(startDate.getTime() + i * MS_IN_DAY);
      const label = currentDate.toLocaleDateString('en-US', {
        weekday: 'short',
      });
      const keyDate = new Date(currentDate);
      keyDate.setHours(0, 0, 0, 0);
      const key = keyDate.toISOString().split('T')[0] as string;

      const endOfDay = new Date(keyDate);
      endOfDay.setHours(23, 59, 59, 999);

      periodEntries.push({ key, label, start: keyDate, end: endOfDay });
      movementData.set(key, { label, inbound: 0, outbound: 0, orders: 0 });
    }

    orders.forEach((order) => {
      const orderDate = new Date(order.shopifyCreatedAt);
      orderDate.setHours(0, 0, 0, 0);
      const key = orderDate.toISOString().split('T')[0] as string;
      const entry = movementData.get(key);
      if (!entry) return;

      const items = itemsByOrder.get(order._id.toString()) || [];
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      entry.outbound += totalQuantity;
      entry.orders += 1;
    });

    inventory.forEach((inv) => {
      if (!inv.incoming || inv.incoming <= 0) return;
      const updatedAt = inv.updatedAt ?? inv.syncedAt;
      const updateDate = new Date(updatedAt);
      updateDate.setHours(0, 0, 0, 0);
      const key = updateDate.toISOString().split('T')[0] as string;
      const entry = movementData.get(key);
      if (!entry) return;
      entry.inbound += inv.incoming;
    });

    const results = periodEntries.map(({ key, label }) => {
      const fallback = { inbound: 0, outbound: 0, orders: 0, label };
      const data = movementData.get(key) ?? fallback;
      const velocity =
        data.orders > 0
          ? Math.round((data.outbound / Math.max(1, data.orders)) * 10) / 10
          : 0;

      return {
        period: label,
        inbound: data.inbound,
        outbound: data.outbound,
        netMovement: data.inbound - data.outbound,
        velocity,
      };
    });

    return results;
  },
});

/**
 * Get inventory turnover data
 */
export const getInventoryTurnover = query({
  args: {
    dateRange: v.optional(
      v.object({
        startDate: v.string(),
        endDate: v.string(),
      }),
    ),
    periods: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      period: v.string(),
      turnoverRate: v.number(),
      daysInInventory: v.number(),
      stockValue: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const orgId = auth.orgId as Id<'organizations'>;
    await primeVariantCostComponents(ctx, orgId);
    const periods = args.periods || 6;

    const fallbackWindowDays = Math.max(30, periods * 30);
    const { start, end } = normalizeDateRange(args.dateRange, fallbackWindowDays);

    const [variants, inventory] = await Promise.all([
      ctx.db
        .query("shopifyProductVariants")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
      ctx.db
        .query("shopifyInventoryTotals")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect(),
    ]);

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    const inventoryCost = variants.reduce((sum, variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      return sum + getVariantCost(variant) * available;
    }, 0);

    const inventoryRetailValue = variants.reduce((sum, variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      return sum + (variant.price || 0) * available;
    }, 0);

    const { orders, orderItems } = await fetchOrdersWithItems(
      ctx,
      orgId,
      start,
      end,
    );

    const itemsByOrder = new Map<string, Array<Doc<'shopifyOrderItems'>>>();
    orderItems.forEach((item) => {
      const key = item.orderId.toString();
      const existing = itemsByOrder.get(key);
      if (existing) {
        existing.push(item);
      } else {
        itemsByOrder.set(key, [item]);
      }
    });

    const variantMap = new Map<
      Id<'shopifyProductVariants'>,
      Doc<'shopifyProductVariants'>
    >();
    variants.forEach((variant) => {
      variantMap.set(variant._id, variant);
    });

    const periodsData = [] as Array<{
      period: string;
      start: Date;
      end: Date;
      unitsSold: number;
      cogsSold: number;
    }>;

    const baseStart = new Date(start);
    baseStart.setHours(0, 0, 0, 0);
    const baseEnd = new Date(end);
    baseEnd.setHours(23, 59, 59, 999);
    const totalDurationMs = Math.max(
      MS_IN_DAY,
      baseEnd.getTime() - baseStart.getTime(),
    );
    const segmentMs = Math.ceil(totalDurationMs / periods);

    for (let i = 0; i < periods; i++) {
      const segmentStart = new Date(baseStart.getTime() + i * segmentMs);
      const segmentEnd =
        i === periods - 1
          ? baseEnd
          : new Date(baseStart.getTime() + (i + 1) * segmentMs - 1);

      if (segmentStart.getTime() > baseEnd.getTime()) {
        break;
      }

      const clampedEnd = segmentEnd.getTime() > baseEnd.getTime()
        ? baseEnd
        : segmentEnd;

      const label = clampedEnd.toLocaleString('en-US', {
        month: 'short',
      });

      periodsData.push({
        period: label,
        start: segmentStart,
        end: clampedEnd,
        unitsSold: 0,
        cogsSold: 0,
      });
    }

    orders.forEach((order) => {
      const createdAt = new Date(order.shopifyCreatedAt);
      const period = periodsData.find(
        (window) =>
          createdAt.getTime() >= window.start.getTime() &&
          createdAt.getTime() <= window.end.getTime(),
      );
      if (!period) return;

      const items = itemsByOrder.get(order._id.toString()) || [];
      items.forEach((item) => {
        if (!item.variantId) return;
        const variant = variantMap.get(item.variantId);
        if (!variant) return;

        const cost = getVariantCost(variant);
        period.unitsSold += item.quantity;
        period.cogsSold += item.quantity * cost;
      });
    });

    const results = periodsData.map((period) => {
      const periodDays = Math.max(
        1,
        Math.ceil((period.end.getTime() - period.start.getTime()) / MS_IN_DAY),
      );
      const annualizationFactor = 365 / periodDays;
      const turnoverRate =
        inventoryCost > 0
          ? Math.round(
              ((period.cogsSold * annualizationFactor) / inventoryCost) * 10,
            ) /
            10
          : 0;
      const daysInInventory =
        turnoverRate > 0 ? Math.round(365 / turnoverRate) : 0;

      return {
        period: period.period,
        turnoverRate,
        daysInInventory,
        stockValue: Math.round(inventoryRetailValue),
      };
    });

    return results;
  },
});

export const getInventoryMetrics = action({
  args: {
    dateRange: v.optional(v.object({ startDate: v.string(), endDate: v.string() })),
  },
  returns: v.union(
    v.null(),
    v.object({
      overview: v.any(),
      stockAlerts: v.any(),
      topPerformers: v.any(),
      stockMovement: v.any(),
    }),
  ),
  handler: async (ctx, args): Promise<{
    overview: any;
    stockAlerts: any;
    topPerformers: any;
    stockMovement: any;
  } | null> => {
    const [overview, stockAlerts, topPerformers, stockMovement] = await Promise.all([
      ctx.runQuery(api.web.inventory.getInventoryOverview, {
        dateRange: args.dateRange,
      }),
      ctx.runQuery(api.web.inventory.getStockAlerts, {
        limit: 10,
      }),
      ctx.runQuery(api.web.inventory.getTopPerformers, {
        dateRange: args.dateRange,
        limit: 3,
      }),
      ctx.runQuery(api.web.inventory.getStockMovement, {
        dateRange: args.dateRange,
        periods: 7,
      }),
    ]);

    return {
      overview,
      stockAlerts,
      topPerformers,
      stockMovement,
    };
  },
});
