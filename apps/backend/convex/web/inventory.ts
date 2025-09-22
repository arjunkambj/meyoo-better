import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { getUserAndOrg } from "../utils/auth";

/**
 * Inventory Management API
 * Provides product inventory data, stock health metrics, and ABC analysis
 */

const aggregateInventoryLevels = (
  levels: Array<Doc<"shopifyInventory">>,
): Map<
  Id<"shopifyProductVariants">,
  { available: number; incoming: number; committed: number }
> => {
  const totals = new Map<
    Id<"shopifyProductVariants">,
    { available: number; incoming: number; committed: number }
  >();

  for (const level of levels) {
    const current = totals.get(level.variantId);
    const available = typeof level.available === "number" ? level.available : 0;
    const incoming = typeof level.incoming === "number" ? level.incoming : 0;
    const committed = typeof level.committed === "number" ? level.committed : 0;

    if (current) {
      current.available += available;
      current.incoming += incoming;
      current.committed += committed;
    } else {
      totals.set(level.variantId, {
        available,
        incoming,
        committed,
      });
    }
  }

  return totals;
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
      .query("shopifyInventory")
      .withIndex("by_organization", (q) => q.eq("organizationId", _orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory);

    // Calculate metrics
    const totalProducts = products.length;
    const totalSKUs = variants.length;

    // Calculate total inventory value and COGS
    let totalValue = 0;
    let totalCOGS = 0;

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;
      const price = variant.price || 0;
      // Use actual cost if available, otherwise estimate at 60% of price
      const cost =
        variant.compareAtPrice && variant.compareAtPrice < price
          ? variant.compareAtPrice * 0.4 // If we have compare price, use 40% of it as cost
          : price * 0.6; // Otherwise estimate cost at 60% of price

      totalValue += available * price; // Retail value
      totalCOGS += available * cost; // Cost value
    });

    // Count stock levels
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let healthyItems = 0;

    variants.forEach((variant) => {
      const totals = inventoryTotals.get(variant._id);
      const available = totals?.available ?? 0;

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

    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order")
      .collect();

    const soldVariantIds = new Set<string>();

    recentOrdersInRange.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        if (item.variantId) soldVariantIds.add(item.variantId);
      });
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

    // Calculate average turnover rate (COGS sold / Average inventory value)
    // Get sales data for the period
    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersForTurnover = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .gte("shopifyCreatedAt", thirtyDaysAgo.getTime()),
      )
      .collect();

    // Calculate total COGS sold in period
    let totalCOGSSold = 0;

    ordersForTurnover.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        const variant = variants.find((v) => v._id === item.variantId);

        if (variant) {
          const cost =
            variant.compareAtPrice && variant.compareAtPrice < variant.price
              ? variant.compareAtPrice * 0.4
              : (variant.price || 0) * 0.6;

          totalCOGSSold += cost * item.quantity;
        }
      });
    });

    // Annual turnover rate = (COGS sold in 30 days * 12) / Current inventory value
    const avgTurnoverRate =
      totalCOGS > 0
        ? Math.round(((totalCOGSSold * 12) / totalCOGS) * 10) / 10
        : 0;

    // Calculate stock coverage days based on average daily sales
    // Use existing orders data from turnover calculation
    let totalUnitsSoldIn30Days = 0;

    ordersForTurnover.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      totalUnitsSoldIn30Days += items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
    });

    const avgDailyUnitsSold = totalUnitsSoldIn30Days / 30;

    // Total units in stock
    const totalUnitsInStock = inventory.reduce(
      (sum, inv) => sum + (inv.available || 0),
      0,
    );

    // Stock coverage = Total units in stock / Average daily units sold
    const stockCoverageDays =
      avgDailyUnitsSold > 0
        ? Math.round(totalUnitsInStock / avgDailyUnitsSold)
        : totalUnitsInStock > 0
          ? 90
          : 0; // Default to 90 days if no sales but have stock

    // Calculate sales metrics for the date range
    const dateRangeStart = args.dateRange?.startDate
      ? new Date(args.dateRange.startDate)
      : thirtyDaysAgo;
    const dateRangeEnd = args.dateRange?.endDate
      ? new Date(args.dateRange.endDate)
      : new Date();

    const ordersInDateRange = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .gte("shopifyCreatedAt", dateRangeStart.getTime())
          .lte("shopifyCreatedAt", dateRangeEnd.getTime()),
      )
      .collect();

    let totalSales = 0;
    let unitsSold = 0;
    let totalProfit = 0;

    ordersInDateRange.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        const variant = variants.find((v) => v._id === item.variantId);

        if (variant) {
          const price = variant.price || 0;
          const cost =
            variant.compareAtPrice && variant.compareAtPrice < price
              ? variant.compareAtPrice * 0.4
              : price * 0.6;

          totalSales += price * item.quantity;
          unitsSold += item.quantity;
          totalProfit += (price - cost) * item.quantity;
        }
      });
    });

    const averageSalePrice = unitsSold > 0 ? totalSales / unitsSold : 0;
    const averageProfit = unitsSold > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Calculate changes by comparing with previous period
    // Calculate previous period dates
    const periodDuration = dateRangeEnd.getTime() - dateRangeStart.getTime();
    const prevEndDate = new Date(dateRangeStart.getTime() - 1); // Day before current start
    const prevStartDate = new Date(prevEndDate.getTime() - periodDuration);

    // Get previous period orders
    const prevOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .gte("shopifyCreatedAt", prevStartDate.getTime())
          .lte("shopifyCreatedAt", prevEndDate.getTime()),
      )
      .collect();

    // Calculate previous period metrics
    let prevTotalSales = 0;
    let prevUnitsSold = 0;
    let prevTotalCOGSSold = 0;

    prevOrders.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        const variant = variants.find((v) => v._id === item.variantId);

        if (variant) {
          const price = variant.price || 0;
          const cost =
            variant.compareAtPrice && variant.compareAtPrice < price
              ? variant.compareAtPrice * 0.4
              : price * 0.6;

          prevTotalSales += price * item.quantity;
          prevUnitsSold += item.quantity;
          prevTotalCOGSSold += cost * item.quantity;
        }
      });
    });

    // Previous period turnover rate
    const prevTurnoverRate =
      totalCOGS > 0
        ? Math.round(((prevTotalCOGSSold * 12) / totalCOGS) * 10) / 10
        : 0;

    // Previous period stock coverage (simplified - use current inventory as approximation)
    const prevAvgDailyUnitsSold =
      prevUnitsSold / Math.max(1, prevOrders.length);
    const prevStockCoverageDays =
      prevAvgDailyUnitsSold > 0
        ? Math.round(totalUnitsInStock / prevAvgDailyUnitsSold)
        : stockCoverageDays; // Use current if no previous sales

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;

      return (
        Math.round(((current - previous) / Math.abs(previous)) * 100 * 10) / 10
      );
    };

    const changes = {
      totalValue: calculateChange(totalValue, totalValue * 0.95), // Approximate as inventory value changes slowly
      totalCOGS: calculateChange(totalCOGS, totalCOGS * 0.95), // Approximate as COGS changes slowly
      totalSKUs: calculateChange(totalSKUs, totalSKUs), // SKUs typically stable
      turnoverRate: calculateChange(avgTurnoverRate, prevTurnoverRate),
      healthScore: calculateChange(healthScore, healthScore * 0.98), // Health score changes slowly
      stockCoverage: calculateChange(stockCoverageDays, prevStockCoverageDays),
      totalSales: calculateChange(totalSales, prevTotalSales),
      unitsSold: calculateChange(unitsSold, prevUnitsSold),
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
    const orgId = auth.orgId as Id<'organizations'>;

    const page = args.page || 1;
    const pageSize = args.pageSize || 50;

    // Get products
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Get variants
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Get inventory
    const inventory = await ctx.db
      .query("shopifyInventory")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory);

    // Get order data for turnover calculation
    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", orgId).gte("shopifyCreatedAt", thirtyDaysAgo.getTime()),
      )
      .collect();

    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order")
      .collect();

    // Calculate sales by variant for turnover
    const variantSales = new Map<string, number>();

    recentOrders.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        if (item.variantId) {
          variantSales.set(
            item.variantId,
            (variantSales.get(item.variantId) || 0) + item.quantity,
          );
        }
      });
    });

    // Map products with inventory data
    const productsWithInventory = products.map((product) => {
      const productVariants = variants.filter(
        (v) => v.productId === product._id,
      );
      const variantInventory = productVariants.map((variant) => {
        const totals = inventoryTotals.get(variant._id);
        const available = totals?.available ?? 0;
        const committed = totals?.committed ?? 0;

        return {
          id: variant._id,
          sku: variant.sku || "N/A",
          title: variant.title || "Default",
          price: variant.price || 0,
          stock: available,
          reserved: committed,
          available,
        };
      });

      // Calculate totals
      const totalStock = variantInventory.reduce((sum, v) => sum + v.stock, 0);
      const totalReserved = variantInventory.reduce(
        (sum, v) => sum + v.reserved,
        0,
      );
      const totalAvailable = variantInventory.reduce(
        (sum, v) => sum + v.available,
        0,
      );

      // Determine stock status
      let stockStatus: "healthy" | "low" | "critical" | "out" = "healthy";

      if (totalAvailable === 0) {
        stockStatus = "out";
      } else if (totalAvailable < 5) {
        stockStatus = "critical";
      } else if (totalAvailable < 20) {
        stockStatus = "low";
      }

      // Calculate price and cost (using first variant as default)
      const defaultVariant = productVariants[0];
      const price = defaultVariant?.price || 0;
      const cost =
        defaultVariant?.compareAtPrice && defaultVariant.compareAtPrice < price
          ? defaultVariant.compareAtPrice * 0.4
          : price * 0.6;
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

      // Calculate actual turnover rate based on sales
      // Turnover = (Units sold in 30 days * 12) / Current stock
      let productUnitsSold = 0;

      productVariants.forEach((variant) => {
        const sales = variantSales.get(variant._id) || 0;

        productUnitsSold += sales;
      });

      const annualizedSales = productUnitsSold * 12; // Annualize 30-day sales
      const turnoverRate =
        totalAvailable > 0
          ? Math.round((annualizedSales / totalAvailable) * 10) / 10
          : 0;

      // Assign ABC category based on turnover rate
      const abcCategory: "A" | "B" | "C" =
        turnoverRate > 6 ? "A" : turnoverRate > 4 ? "B" : "C";

      // Find last sold date
      let lastSold: string | undefined;
      const productOrderItems = orderItems.filter((item) =>
        productVariants.some((v) => v._id === item.variantId),
      );

      if (productOrderItems.length > 0) {
        const lastOrder = recentOrders
          .filter((o) =>
            productOrderItems.some((item) => item.orderId === o._id),
          )
          .sort(
            (a, b) =>
              new Date(b.shopifyCreatedAt).getTime() -
              new Date(a.shopifyCreatedAt).getTime(),
          )[0];

        if (lastOrder) {
          lastSold = new Date(lastOrder.shopifyCreatedAt).toISOString();
        }
      }

      return {
        id: product._id,
        name: product.title,
        sku: productVariants[0]?.sku || product.handle || "N/A",
        image: product.featuredImage,
        category: product.productType || "Uncategorized",
        vendor: product.vendor || "Unknown",
        stock: totalStock,
        reserved: totalReserved,
        available: totalAvailable,
        reorderPoint: 10, // Mock reorder point
        stockStatus,
        price,
        cost,
        margin,
        turnoverRate,
        unitsSold: productUnitsSold,
        lastSold,
        variants: variantInventory.length > 1 ? variantInventory : undefined,
        abcCategory,
      };
    });

    // Apply filters
    let filteredProducts = productsWithInventory;

    // Filter by stock level
    if (args.stockLevel) {
      filteredProducts = filteredProducts.filter(
        (p) => p.stockStatus === args.stockLevel,
      );
    }

    // Filter by ABC category
    if (args.category && args.category !== "all") {
      filteredProducts = filteredProducts.filter(
        (p) => p.abcCategory === args.category,
      );
    }

    // Search filter
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();

      filteredProducts = filteredProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.vendor.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term),
      );
    }

    // Sort
    if (args.sortBy) {
      filteredProducts.sort((a, b) => {
        const sortKey = args.sortBy as keyof typeof a;
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const order = args.sortOrder === "desc" ? -1 : 1;

        if (aVal === undefined || bVal === undefined) {
          return 0;
        }
        return aVal > bVal ? order : -order;
      });
    }

    // Paginate
    const total = filteredProducts.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paginatedData = filteredProducts.slice(start, start + pageSize);

    return {
      data: paginatedData,
      pagination: {
        page,
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

    // Get variants and inventory
    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const inventory = await ctx.db
      .query("shopifyInventory")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory);

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

    // Get products
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Mock ABC distribution
    const total = products.length;
    const aCount = Math.floor(total * 0.2);
    const bCount = Math.floor(total * 0.3);
    const cCount = total - aCount - bCount;

    return [
      {
        category: "A" as const,
        label: "High Value",
        description: "Top 20% of products generating 80% of revenue",
        productCount: aCount,
        valuePercentage: 80,
        volumePercentage: 20,
        revenue: 480000,
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
        description: "Middle 30% of products generating 15% of revenue",
        productCount: bCount,
        valuePercentage: 15,
        volumePercentage: 30,
        revenue: 90000,
        color: "warning",
        icon: "solar:square-bold-duotone",
        recommendations: [
          "Regular stock review",
          "Consider bundling opportunities",
          "Optimize reorder points",
        ],
      },
      {
        category: "C" as const,
        label: "Low Value",
        description: "Bottom 50% of products generating 5% of revenue",
        productCount: cCount,
        valuePercentage: 5,
        volumePercentage: 50,
        revenue: 30000,
        color: "default",
        icon: "solar:circle-bold-duotone",
        recommendations: [
          "Evaluate for discontinuation",
          "Reduce stock levels",
          "Consider clearance sales",
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

    // Get products with low stock
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(args.limit || 10);

    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const inventory = await ctx.db
      .query("shopifyInventory")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const inventoryTotals = aggregateInventoryLevels(inventory);

    const alerts: {
      id: string;
      type: "critical" | "low" | "reorder" | "overstock";
      productName: string;
      sku: string;
      currentStock: number;
      reorderPoint?: number;
      daysUntilStockout?: number;
      message: string;
    }[] = [];

    products.forEach((product) => {
      const productVariants = variants.filter(
        (v) => v.productId === product._id,
      );

      productVariants.forEach((variant) => {
        const totals = inventoryTotals.get(variant._id);
        const available = totals?.available ?? 0;

        if (available === 0) {
          alerts.push({
            id: `${variant._id}-out`,
            type: "critical" as const,
            productName: product.title,
            sku: variant.sku || "N/A",
            currentStock: 0,
            reorderPoint: 10,
            message: "Product is out of stock. Immediate reorder required.",
          });
        } else if (available < 5) {
          alerts.push({
            id: `${variant._id}-critical`,
            type: "critical" as const,
            productName: product.title,
            sku: variant.sku || "N/A",
            currentStock: available,
            reorderPoint: 10,
            daysUntilStockout: Math.floor(available / 2), // Mock calculation
            message: `Critical stock level. Only ${available} units remaining.`,
          });
        } else if (available < 20) {
          alerts.push({
            id: `${variant._id}-low`,
            type: "low" as const,
            productName: product.title,
            sku: variant.sku || "N/A",
            currentStock: available,
            reorderPoint: 20,
            daysUntilStockout: Math.floor(available / 2), // Mock calculation
            message: `Low stock warning. Consider reordering soon.`,
          });
        }
      });
    });

    return alerts.slice(0, args.limit || 10);
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

    // Get products
    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    const variants = await ctx.db
      .query("shopifyProductVariants")
      .withIndex("by_organization", (q) => q.eq("organizationId", auth.orgId as Id<"organizations">))
      .collect();

    // Get actual sales data
    const endDate = args.dateRange?.endDate
      ? new Date(args.dateRange.endDate)
      : new Date();
    const startDate = args.dateRange?.startDate
      ? new Date(args.dateRange.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get orders in date range using index
    const ordersInRange = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<"organizations">)
          .gte("shopifyCreatedAt", startDate.getTime())
          .lte("shopifyCreatedAt", endDate.getTime()),
      )
      .collect();

    // Get order items
    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order")
      .collect();

    // Calculate sales by product
    const productSales = new Map<string, { units: number; revenue: number }>();

    ordersInRange.forEach((order) => {
      const items = orderItems.filter((item) => item.orderId === order._id);

      items.forEach((item) => {
        const variant = variants.find((v) => v._id === item.variantId);

        if (variant) {
          const product = products.find((p) => p._id === variant.productId);

          if (product) {
            const current = productSales.get(product._id) || {
              units: 0,
              revenue: 0,
            };

            productSales.set(product._id, {
              units: current.units + item.quantity,
              revenue: current.revenue + item.quantity * (variant.price || 0),
            });
          }
        }
      });
    });

    // Convert to array and calculate metrics
    const performanceData = Array.from(productSales.entries())
      .map(([productId, sales]) => {
        const product = products.find((p) => p._id === productId);
        const variant = variants.find((v) => v.productId === productId);

        if (!product) return null;

        // Calculate change (mock for now, would compare with previous period)
        const change =
          sales.units > 100 ? 25.5 : sales.units > 50 ? 12.3 : -5.2;

        return {
          id: product._id,
          name: product.title,
          sku: variant?.sku || product.handle || "N/A",
          image: product.featuredImage,
          metric: sales.units,
          change,
          units: sales.units,
          revenue: sales.revenue,
          trend:
            change > 0
              ? ("up" as const)
              : change < 0
                ? ("down" as const)
                : ("stable" as const),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort and categorize
    const sorted = [...performanceData].sort((a, b) => b.units - a.units);
    const best = sorted.slice(0, limit);
    const worst = sorted.slice(-limit).reverse();
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

    const periods = args.periods || 7;
    const endDate = args.dateRange?.endDate
      ? new Date(args.dateRange.endDate)
      : new Date();
    const startDate = args.dateRange?.startDate
      ? new Date(args.dateRange.startDate)
      : new Date(endDate.getTime() - (periods - 1) * 24 * 60 * 60 * 1000);

    // Get all orders in the date range using index
    const filteredOrders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q
          .eq("organizationId", auth.orgId as Id<'organizations'>)
          .gte("shopifyCreatedAt", startDate.getTime())
          .lte("shopifyCreatedAt", endDate.getTime()),
      )
      .collect();

    // Get all order items for these orders
    const orderIds = filteredOrders.map((o) => o._id);
    const orderItems = await ctx.db
      .query("shopifyOrderItems")
      .withIndex("by_order")
      .collect();

    const relevantOrderItems = orderItems.filter((item) =>
      orderIds.includes(item.orderId),
    );

    // Get inventory changes (we'll track inventory snapshots)
    const inventory = await ctx.db
      .query("shopifyInventory")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", auth.orgId as Id<'organizations'>),
      )
      .collect();

    // Group data by period
    const movementData: Record<
      string,
      { inbound: number; outbound: number; orders: number }
    > = {};

    // Initialize periods
    for (let i = 0; i < periods; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const periodKey = date.toLocaleDateString("en-US", { weekday: "short" });

      movementData[periodKey] = { inbound: 0, outbound: 0, orders: 0 };
    }

    // Calculate outbound from orders
    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.shopifyCreatedAt);
      const periodKey = orderDate.toLocaleDateString("en-US", {
        weekday: "short",
      });

      if (movementData[periodKey]) {
        // Count items sold (outbound)
        const orderItemsForOrder = relevantOrderItems.filter(
          (item) => item.orderId === order._id,
        );
        const totalQuantity = orderItemsForOrder.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        movementData[periodKey].outbound += totalQuantity;
        movementData[periodKey].orders += 1;
      }
    });

    // Calculate inbound from inventory incoming field
    // For now, we'll estimate inbound based on restocking patterns
    Object.keys(movementData).forEach((period) => {
      // Get total incoming inventory
      const totalIncoming = inventory.reduce(
        (sum, inv) => sum + (inv.incoming || 0),
        0,
      );

      // Distribute incoming across periods (simplified)
      if (!movementData[period]) {
        (movementData as any)[period] = { inbound: 0, outbound: 0, orders: 0 };
      }
      movementData[period]!.inbound = Math.round(totalIncoming / periods);
    });

    // Convert to array format
    const result = Object.keys(movementData).map((period) => {
      const data = movementData[period] || { inbound: 0, outbound: 0, orders: 0 };
      const velocity =
        data.orders > 0
          ? Math.round(data.outbound / Math.max(1, data.orders))
          : 0;

      return {
        period,
        inbound: data.inbound,
        outbound: data.outbound,
        netMovement: data.inbound - data.outbound,
        velocity,
      };
    });

    return result;
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

    const periods = args.periods || 7;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentMonth = new Date().getMonth();

    // Generate mock turnover data
    const data = [];

    for (let i = periods - 1; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const turnoverRate = 4 + Math.random() * 2; // Between 4 and 6
      const daysInInventory = Math.round(365 / turnoverRate);
      const stockValue = 150000 - i * 5000 + Math.random() * 10000;

      data.push({
        period: months[monthIndex] || "",
        turnoverRate: parseFloat(turnoverRate.toFixed(1)),
        daysInInventory,
        stockValue: Math.round(stockValue),
      });
    }

    return data;
  },
});
