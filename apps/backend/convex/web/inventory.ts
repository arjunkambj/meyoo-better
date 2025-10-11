import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

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
const DEFAULT_LEAD_TIME_DAYS = 7;
const SAFETY_STOCK_DAYS = 3;

const INVENTORY_END_CURSOR = "__end__";

const encodeInventoryCursor = (state: { page: number }): string =>
  JSON.stringify({ page: Math.max(1, Math.floor(state.page)) });

const decodeInventoryCursor = (
  rawCursor: string | null | undefined,
): { page: number } => {
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
  args: {},
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
      averageProfit: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const { user } = auth;
    const _orgId = auth.orgId as Id<"organizations">;

    await primeVariantCostComponents(ctx, _orgId);

    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    const inventory = await ctx.db
      .query("shopifyInventoryTotals")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory, variants);

    const { start, end } = normalizeDateRange(
      undefined,
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

    const averageProfit = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

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
      averageProfit,
    };
  },
});

/**
 * Get paginated products list with inventory data
 */
export const getProductsList = query({
  args: {
    paginationOpts: v.optional(paginationOptsValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    stockLevel: v.optional(v.string()),
    category: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
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
    data: v.optional(
      v.array(
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
    ),
    continueCursor: v.string(),
    isDone: v.boolean(),
    info: v.object({
      pageSize: v.number(),
      returned: v.number(),
      hasMore: v.boolean(),
    }),
    pagination: v.object({
      page: v.number(),
      pageSize: v.number(),
      total: v.number(),
      totalPages: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const fallbackPageSize = Math.max(
      1,
      Math.floor(args.paginationOpts?.numItems ?? args.pageSize ?? 50),
    );

    if (!auth)
      return {
        page: [],
        data: [],
        continueCursor: INVENTORY_END_CURSOR,
        isDone: true,
        info: {
          pageSize: fallbackPageSize,
          returned: 0,
          hasMore: false,
        },
        pagination: {
          page: 1,
          pageSize: fallbackPageSize,
          total: 0,
          totalPages: 0,
        },
      };
    const orgId = auth.orgId as Id<"organizations">;

    await primeVariantCostComponents(ctx, orgId);

    const cursorState = decodeInventoryCursor(args.paginationOpts?.cursor);
    const legacyPage = args.page ?? 1;
    const pageSize = Math.max(
      1,
      Math.floor(args.paginationOpts?.numItems ?? args.pageSize ?? 50),
    );
    const requestedPage = args.paginationOpts
      ? cursorState.page
      : Math.max(1, Math.floor(legacyPage));

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
      undefined,
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
    const safePage = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
    const startIndex = (safePage - 1) * pageSize;
    const paginatedData = filteredProducts.slice(
      startIndex,
      startIndex + pageSize,
    );

    const hasMore = totalPages > 0 && safePage < totalPages;
    const continueCursor = hasMore
      ? encodeInventoryCursor({ page: safePage + 1 })
      : INVENTORY_END_CURSOR;

    return {
      page: paginatedData,
      data: paginatedData,
      continueCursor,
      isDone: !hasMore,
      info: {
        pageSize,
        returned: paginatedData.length,
        hasMore,
      },
      pagination: {
        page: totalPages === 0 ? 1 : safePage,
        pageSize,
        total,
        totalPages,
      },
    };
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
