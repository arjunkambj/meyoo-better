import type {
  AnalyticsDatasetKey,
  AnalyticsOrder,
  AnalyticsSourceData,
  AnalyticsSourceResponse,
  ChannelRevenueBreakdown,
  MetricValue,
  OrdersAnalyticsExportRow,
  OrdersAnalyticsResult,
  OrdersFulfillmentMetrics,
  OrdersOverviewMetrics,
  OverviewComputation,
  OverviewSummary,
  PlatformMetrics,
  PnLAnalyticsResult,
  PnLGranularity,
  PnLKPIMetrics,
  PnLMetrics,
  PnLTablePeriod,
} from "@repo/types";

type AnyRecord = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;

function filterAccountLevelMetaInsights(metaInsights: AnyRecord[]): AnyRecord[] {
  return metaInsights.filter((insight) => {
    const entityType = typeof insight?.entityType === "string"
      ? insight.entityType.toLowerCase()
      : null;
    return entityType === null || entityType === "account";
  });
}

function parseDateBoundary(value: string | undefined, end = false): number {
  if (!value) {
    const now = new Date();
    if (end) {
      now.setUTCHours(23, 59, 59, 999);
    } else {
      now.setUTCHours(0, 0, 0, 0);
    }
    return now.getTime();
  }

  const suffix = end ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const normalized = value.includes("T") ? value : `${value}${suffix}`;
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    const fallback = new Date();
    if (end) {
      fallback.setUTCHours(23, 59, 59, 999);
    } else {
      fallback.setUTCHours(0, 0, 0, 0);
    }
    return fallback.getTime();
  }
  return parsed;
}

function getFrequencyDurationMs(cost: AnyRecord): number | null {
  const rawFrequency = String(
    cost.frequency ?? cost.recurrence ?? cost.intervalUnit ?? cost.interval ?? "",
  ).toLowerCase();

  switch (rawFrequency) {
    case "day":
    case "daily":
      return DAY_MS;
    case "week":
    case "weekly":
      return 7 * DAY_MS;
    case "biweekly":
    case "fortnight":
    case "fortnightly":
      return 14 * DAY_MS;
    case "month":
    case "monthly":
      return 30 * DAY_MS;
    case "bimonthly":
      return 60 * DAY_MS;
    case "quarter":
    case "quarterly":
      return 91 * DAY_MS;
    case "semiannual":
    case "semiannually":
    case "biannual":
      return 182 * DAY_MS;
    case "year":
    case "yearly":
    case "annual":
    case "annually":
      return 365 * DAY_MS;
    default:
      return null;
  }
}

function computeCostOverlap(
  cost: AnyRecord,
  rangeStartMs: number,
  rangeEndMs: number,
): { overlapMs: number; windowMs: number | null } {
  const rawFrom = cost.effectiveFrom;
  const rawTo = cost.effectiveTo;

  const hasExplicitFrom = rawFrom !== undefined && rawFrom !== null;
  const hasExplicitEnd = rawTo !== undefined && rawTo !== null;

  const startCandidate = hasExplicitFrom ? safeNumber(rawFrom) : rangeStartMs;
  const endCandidate = hasExplicitEnd ? safeNumber(rawTo) : rangeEndMs;

  const start = Number.isFinite(startCandidate) ? startCandidate : rangeStartMs;
  const end = Number.isFinite(endCandidate) ? endCandidate : rangeEndMs;

  const overlapStart = Math.max(rangeStartMs, start);
  const overlapEnd = Math.min(rangeEndMs, end);
  const overlapMs = overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;

  if (hasExplicitFrom && hasExplicitEnd && end > start) {
    return { overlapMs, windowMs: end - start };
  }

  return { overlapMs, windowMs: null };
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sumBy<T>(items: T[] | undefined, getter: (item: T) => number): number {
  if (!items?.length) return 0;
  return items.reduce((total, item) => total + getter(item), 0);
}

function toStringId(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("id" in (value as AnyRecord) && typeof (value as AnyRecord).id === "string") {
      return (value as AnyRecord).id as string;
    }
    if ("_id" in (value as AnyRecord) && typeof (value as AnyRecord)._id === "string") {
      return (value as AnyRecord)._id as string;
    }
  }
  return String(value ?? "");
}

function ensureDataset<T = AnyRecord>(
  response: AnalyticsSourceResponse<T> | null | undefined,
): AnalyticsSourceData<T> | null {
  if (!response) return null;
  return (response.data ?? {}) as AnalyticsSourceData<T>;
}

function defaultMetric(value = 0, change = 0): MetricValue {
  return { value, change };
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function overlapsWindow(
  entryStart: number,
  entryEnd: number,
  window?: { start: number; end: number },
): boolean {
  if (!window) return true;
  const normalizedStart = Number.isFinite(entryStart)
    ? entryStart
    : Number.NEGATIVE_INFINITY;
  const normalizedEnd = Number.isFinite(entryEnd)
    ? entryEnd
    : Number.POSITIVE_INFINITY;
  return normalizedStart <= window.end && normalizedEnd >= window.start;
}

function resolveManualReturnRate(
  entries: AnyRecord[] | undefined,
  window?: { start: number; end: number },
): { ratePercent: number } {
  if (!entries?.length) {
    return { ratePercent: 0 };
  }

  const filtered = entries.filter((entry) => {
    const activeFlag = entry.isActive;
    if (activeFlag === false) {
      // Allow inactive entries if they overlap the requested window (for history)
      const from = safeNumber(entry.effectiveFrom ?? entry.createdAt ?? 0);
      const toRaw = entry.effectiveTo;
      const to = toRaw === undefined || toRaw === null ? Number.POSITIVE_INFINITY : safeNumber(toRaw);
      return overlapsWindow(from, to, window) && window !== undefined;
    }

    const from = safeNumber(entry.effectiveFrom ?? entry.createdAt ?? 0);
    const toRaw = entry.effectiveTo;
    const to = toRaw === undefined || toRaw === null ? Number.POSITIVE_INFINITY : safeNumber(toRaw);
    return overlapsWindow(from, to, window);
  });

  if (filtered.length === 0) {
    return { ratePercent: 0 };
  }

  filtered.sort((a, b) => {
    const aTimestamp = safeNumber(a.updatedAt ?? a.effectiveFrom ?? a.createdAt ?? 0);
    const bTimestamp = safeNumber(b.updatedAt ?? b.effectiveFrom ?? b.createdAt ?? 0);
    return bTimestamp - aTimestamp;
  });

  const selected = filtered[0]!;
  const rawRate = safeNumber(selected.ratePercent ?? selected.rate ?? selected.value ?? 0);
  return { ratePercent: clampPercentage(rawRate) };
}

function computeOverviewBaseline(
  response: AnalyticsSourceResponse<any> | null | undefined,
): OverviewComputation | null {
  if (!response) return null;

  const data = ensureDataset(response);
  if (!data) {
    return {
      summary: {
        revenue: 0,
        revenueChange: 0,
        grossSales: 0,
        grossSalesChange: 0,
        discounts: 0,
        discountsChange: 0,
        discountRate: 0,
        discountRateChange: 0,
        refunds: 0,
        refundsChange: 0,
        rtoRevenueLost: 0,
        rtoRevenueLostChange: 0,
        manualReturnRate: 0,
        manualReturnRateChange: 0,
        profit: 0,
        profitChange: 0,
        profitMargin: 0,
        profitMarginChange: 0,
        grossProfit: 0,
        grossProfitChange: 0,
        grossProfitMargin: 0,
        grossProfitMarginChange: 0,
        contributionMargin: 0,
        contributionMarginChange: 0,
        contributionMarginPercentage: 0,
        contributionMarginPercentageChange: 0,
        operatingMargin: 0,
        operatingMarginChange: 0,
        blendedMarketingCost: 0,
        blendedMarketingCostChange: 0,
        metaAdSpend: 0,
        metaAdSpendChange: 0,
        googleAdSpend: 0,
        googleAdSpendChange: 0,
        metaSpendPercentage: 0,
        metaSpendPercentageChange: 0,
        marketingPercentageOfGross: 0,
        marketingPercentageOfGrossChange: 0,
        marketingPercentageOfNet: 0,
        marketingPercentageOfNetChange: 0,
        metaROAS: 0,
        metaROASChange: 0,
        roas: 0,
        roasChange: 0,
        ncROAS: 0,
        ncROASChange: 0,
        poas: 0,
        poasChange: 0,
        orders: 0,
        ordersChange: 0,
        unitsSold: 0,
        unitsSoldChange: 0,
        avgOrderValue: 0,
        avgOrderValueChange: 0,
        avgOrderCost: 0,
        avgOrderCostChange: 0,
        avgOrderProfit: 0,
        avgOrderProfitChange: 0,
        adSpendPerOrder: 0,
        adSpendPerOrderChange: 0,
        profitPerOrder: 0,
        profitPerOrderChange: 0,
        profitPerUnit: 0,
        profitPerUnitChange: 0,
        fulfillmentCostPerOrder: 0,
        fulfillmentCostPerOrderChange: 0,
        cogs: 0,
        cogsChange: 0,
        cogsPercentageOfGross: 0,
        cogsPercentageOfGrossChange: 0,
        cogsPercentageOfNet: 0,
        cogsPercentageOfNetChange: 0,
        shippingCosts: 0,
        shippingCostsChange: 0,
        shippingPercentageOfNet: 0,
        shippingPercentageOfNetChange: 0,
        transactionFees: 0,
        transactionFeesChange: 0,
        handlingFees: 0,
        handlingFeesChange: 0,
        taxesCollected: 0,
        taxesCollectedChange: 0,
        taxesPercentageOfRevenue: 0,
        taxesPercentageOfRevenueChange: 0,
        customCosts: 0,
        customCostsChange: 0,
        customCostsPercentage: 0,
        customCostsPercentageChange: 0,
        customers: 0,
        customersChange: 0,
        newCustomers: 0,
        newCustomersChange: 0,
        returningCustomers: 0,
        returningCustomersChange: 0,
        repeatCustomerRate: 0,
        repeatCustomerRateChange: 0,
        customerAcquisitionCost: 0,
        customerAcquisitionCostChange: 0,
        cacPercentageOfAOV: 0,
        cacPercentageOfAOVChange: 0,
        returnRate: 0,
        returnRateChange: 0,
        moMRevenueGrowth: 0,
        calendarMoMRevenueGrowth: 0,
      },
      metrics: {},
      extras: {
        blendedSessionConversionRate: 0,
        blendedSessionConversionRateChange: 0,
        uniqueVisitors: 0,
      },
    } satisfies OverviewComputation;
  }

  const orders = (data.orders || []) as AnyRecord[];
  const orderItems = (data.orderItems || []) as AnyRecord[];
  const transactions = (data.transactions || []) as AnyRecord[];
  const refunds = (data.refunds || []) as AnyRecord[];
  const metaInsights = (data.metaInsights || []) as AnyRecord[];
  const accountMetaInsights = filterAccountLevelMetaInsights(metaInsights);
  const costs = (data.globalCosts || []) as AnyRecord[];
  const variantCosts = (data.variantCosts || []) as AnyRecord[];
  const variants = (data.variants || []) as AnyRecord[];
  const customers = (data.customers || []) as AnyRecord[];
  const analytics = (data.analytics || []) as AnyRecord[];
  const manualReturnRateEntries = (data.manualReturnRates || []) as AnyRecord[];

  let manualReturnRatePercent = 0;
  if (response?.dateRange?.startDate && response.dateRange?.endDate) {
    const rangeStartMs = parseDateBoundary(response.dateRange.startDate);
    const rangeEndMs = parseDateBoundary(response.dateRange.endDate, true);
    manualReturnRatePercent = resolveManualReturnRate(manualReturnRateEntries, {
      start: rangeStartMs,
      end: rangeEndMs,
    }).ratePercent;
  } else {
    manualReturnRatePercent = resolveManualReturnRate(manualReturnRateEntries).ratePercent;
  }

  const toOrderKey = (order: AnyRecord): string =>
    toStringId(order._id ?? order.id ?? order.orderId ?? order.shopifyId ?? order.order_id);

  const isCancelledOrder = (order: AnyRecord): boolean => {
    const candidates = [
      order.status,
      order.financialStatus,
      order.fulfillmentStatus,
      order.financial_status,
      order.fulfillment_status,
    ];

    return candidates.some((value) => {
      if (!value) return false;
      const normalized = String(value).toLowerCase();
      return (
        normalized.includes("cancel") ||
        normalized.includes("void") ||
        normalized.includes("decline")
      );
    });
  };

  const cancelledOrderIds = new Set<string>();
  for (const order of orders) {
    const key = toOrderKey(order);
    if (key && isCancelledOrder(order)) {
      cancelledOrderIds.add(key);
    }
  }

  const activeOrders = orders.filter((order) => !cancelledOrderIds.has(toOrderKey(order)));
  const activeOrderCount = activeOrders.length;

  const revenue = sumBy(activeOrders, (order) => safeNumber(order.totalPrice));
  const grossSales = sumBy(activeOrders, (order) => safeNumber(order.subtotalPrice ?? order.totalPrice));
  const discounts = sumBy(activeOrders, (order) => safeNumber(order.totalDiscounts));
  // Start with order-level shipping costs as the base
  const shippingCostsFromOrders = sumBy(
    activeOrders,
    (order) => safeNumber(order.shippingCosts ?? 0),
  );
  let shippingCosts = shippingCostsFromOrders;
  let taxesCollected = sumBy(
    activeOrders,
    (order) => safeNumber(order.taxesCollected ?? 0),
  );
  const refundsAmountFromDocs = refunds.length
    ? sumBy(refunds, (refund) => safeNumber(refund.totalRefunded ?? refund.amount))
    : 0;
  const refundsAmountFromOrders = sumBy(orders, (order) => safeNumber(order.totalRefunded ?? order.totalRefunds));
  const refundsAmount = refunds.length ? refundsAmountFromDocs : refundsAmountFromOrders;

  const variantMap = new Map<string, AnyRecord>();
  const variantByShopifyId = new Map<string, AnyRecord>();
  for (const variant of variants) {
    const internalId = toStringId(variant._id ?? variant.id ?? variant.variantId);
    if (internalId) {
      variantMap.set(internalId, variant);
    }
    const shopifyVariantId =
      variant.shopifyVariantId ??
      variant.shopifyVariantID ??
      variant.shopify_variant_id ??
      variant.shopifyVariant ??
      variant.shopifyId ??
      variant.shopify_id;
    if (typeof shopifyVariantId === "string" && shopifyVariantId.trim().length > 0) {
      variantByShopifyId.set(shopifyVariantId.trim(), variant);
    }
  }

  const componentMap = new Map<string, AnyRecord>();
  for (const component of variantCosts) {
    const variantId = toStringId(component.variantId ?? component.variant_id);
    if (!variantId) continue;
    // Don't filter by isActive - if variant was sold, calculate its costs
    // For variants with multiple cost records, use the most recently updated one
    const current = componentMap.get(variantId);
    const currentTime = safeNumber(current?.updatedAt ?? current?.createdAt ?? 0);
    const componentTime = safeNumber(component.updatedAt ?? component.createdAt ?? 0);
    if (!current || componentTime > currentTime) {
      componentMap.set(variantId, component);
    }
  }

  const resolveVariantIdForItem = (item: AnyRecord): string => {
    const direct = toStringId(item.variantId ?? item.variant_id);
    if (direct && (componentMap.has(direct) || variantMap.has(direct))) {
      return direct;
    }
    const shopifyVariantId = item.shopifyVariantId ?? item.shopify_variant_id ?? item.variantShopifyId;
    if (typeof shopifyVariantId === "string" && shopifyVariantId.trim().length > 0) {
      const matchingVariant = variantByShopifyId.get(shopifyVariantId.trim());
      if (matchingVariant) {
        return toStringId(matchingVariant._id ?? matchingVariant.id ?? matchingVariant.variantId);
      }
    }
    return direct;
  };

  const variantQuantities = new Map<string, number>();
  for (const item of orderItems) {
    const variantId = resolveVariantIdForItem(item);
    if (!variantId) continue;
    const orderKey = toStringId(
      item.orderId ?? item.order_id ?? item.order ?? item.shopifyOrderId,
    );
    if (orderKey && cancelledOrderIds.has(orderKey)) {
      continue;
    }
    const quantity = safeNumber(item.quantity);
    if (quantity <= 0) continue;
    const prev = variantQuantities.get(variantId) ?? 0;
    variantQuantities.set(variantId, prev + quantity);
  }

  let cogs = 0;
  let unitsSold = 0;
  let taxFromComponents = 0;
  for (const item of orderItems) {
    const quantity = safeNumber(item.quantity);
    if (quantity <= 0) continue;
    const orderKey = toStringId(
      item.orderId ?? item.order_id ?? item.order ?? item.shopifyOrderId,
    );
    if (orderKey && cancelledOrderIds.has(orderKey)) {
      continue;
    }
    unitsSold += quantity;
    const variantId = resolveVariantIdForItem(item);
    const component = componentMap.get(variantId);
    const perUnit = safeNumber(component?.cogsPerUnit ?? 0);
    let itemCogs = perUnit * quantity;
    if (itemCogs <= 0) {
      const lineCogs = safeNumber(
        item.totalCostOfGoods ?? item.totalCost ?? item.cost ?? item.cogs ?? 0,
      );
      if (lineCogs > 0) {
        itemCogs = lineCogs;
      }
    }
    cogs += itemCogs;

    if (component) {
      const taxPercent = safeNumber(component.taxPercent);
      if (taxPercent > 0) {
        const itemPrice = safeNumber(item.price);
        // If taxPercent is greater than 1, treat as percentage (e.g., 10 for 10%)
        // If less than or equal to 1, treat as decimal (e.g., 0.1 for 10%)
        const taxMultiplier = taxPercent > 1 ? taxPercent / 100 : taxPercent;
        taxFromComponents += (itemPrice * quantity) * taxMultiplier;
      }
    }
  }

  if (unitsSold === 0) {
    unitsSold = sumBy(
      activeOrders,
      (order) =>
        safeNumber(
          order.totalQuantity ??
            order.totalQuantityOrdered ??
            order.totalQuantity ??
            order.totalItems ??
            0,
        ),
    );
  }

  let handlingFromComponents = 0;
  const shippingFromComponents = 0;
  for (const [variantId, quantity] of variantQuantities.entries()) {
    const component = componentMap.get(variantId);
    if (!component) continue;
    handlingFromComponents += safeNumber(component?.handlingPerUnit) * quantity;
  }

  if (taxFromComponents > 0) {
    // Use component-level tax if available
    taxesCollected = taxFromComponents;
  }

  const customersById = new Map<string, AnyRecord>();
  for (const customer of customers) {
    customersById.set(toStringId(customer._id ?? customer.id ?? customer.customerId), customer);
  }

  const ordersPerCustomer = new Map<string, number>();
  for (const order of activeOrders) {
    const customerId = toStringId(order.customerId ?? order.customer_id);
    if (!customerId) continue;
    ordersPerCustomer.set(customerId, (ordersPerCustomer.get(customerId) ?? 0) + 1);
  }

  const uniqueCustomerIds = new Set<string>(ordersPerCustomer.keys());

  let returningCustomers = 0;
  let newCustomers = 0;
  for (const customerId of uniqueCustomerIds) {
    const customer = customersById.get(customerId);
    const fallbackCount = ordersPerCustomer.get(customerId) ?? 0;
    const ordersCount = safeNumber(
      customer?.ordersCount ?? customer?.orders_count ?? fallbackCount,
    );
    if (ordersCount > 1) {
      returningCustomers += 1;
    } else {
      newCustomers += 1;
    }
  }

  const shippingCostEntries = costs.filter((cost) => cost.type === "shipping");
  const operationalCosts = costs.filter((cost) => {
    const type = String(cost.type ?? "");
    return type === "operational" || type === "custom";
  });
  const paymentCostEntries = costs.filter((cost) => cost.type === "payment");

  const rangeStart = parseDateBoundary(response.dateRange.startDate);
  const rangeEnd = parseDateBoundary(response.dateRange.endDate, true);

  const toCostMode = (cost: AnyRecord): string => {
    // Schema has calculation and frequency as separate fields
    // frequency determines if it's per_order, per_unit, etc.
    // calculation determines if it's fixed, percentage, etc.
    const freq = String(cost.frequency ?? "");
    const calc = String(cost.calculation ?? "fixed");

    // Check frequency first for per_order/per_unit patterns
    if (freq === "per_order") return "perOrder";
    if (freq === "per_unit" || freq === "per_item") return "perUnit";

    // Then check calculation for percentage and other modes
    if (calc === "percentage") return "percentageRevenue";
    if (calc === "per_unit") return "perUnit";

    // Default to fixed for monthly, yearly, one_time frequencies
    return "fixed";
  };

  const computeCostAmount = (cost: AnyRecord): number => {
    // Schema uses 'value' field, not 'amount'
    const amount = safeNumber(cost.value ?? cost.amount ?? cost.total ?? 0);
    if (amount === 0) {
      return 0;
    }

    const mode = toCostMode(cost);
    const { overlapMs, windowMs } = computeCostOverlap(cost, rangeStart, rangeEnd);
    if (overlapMs <= 0) {
      return 0;
    }

    const frequencyDuration = getFrequencyDurationMs(cost);

    switch (mode) {
      case "perOrder":
        return amount * activeOrderCount;
      case "perUnit":
        return amount * unitsSold;
      case "percentageRevenue":
        return revenue > 0 ? (amount / 100) * revenue : 0;
      case "timeBound": {
        if (windowMs && windowMs > 0) {
          return amount * (overlapMs / windowMs);
        }
        if (frequencyDuration) {
          return amount * (overlapMs / frequencyDuration);
        }
        return amount;
      }
      default:
        if (frequencyDuration) {
          return amount * (overlapMs / frequencyDuration);
        }
        return amount;
    }
  };

  const customCostTotal = sumBy(operationalCosts, computeCostAmount);
  const paymentCostTotal = sumBy(paymentCostEntries, computeCostAmount);
  // Use computeCostAmount for all cost types - it handles per_order, per_unit, percentage, etc.
  const shippingCostTotal = sumBy(shippingCostEntries, computeCostAmount);
  const handlingCostTotal = handlingFromComponents;

  // Start with order-level shipping (usually 0), then add globalCosts shipping
  shippingCosts = shippingCostsFromOrders + shippingCostTotal;

  // Debug logging for cost calculations
  if (process.env.DEBUG_COSTS === "true") {
    console.log("[Analytics Debug] Cost Calculations:", {
      activeOrderCount,
      unitsSold,
      shippingCostsFromOrders,
      shippingFromComponents,
      shippingCostTotal,
      totalShipping: shippingCosts,
      handlingFromComponents,
      totalHandling: handlingCostTotal,
      taxFromComponents,
      taxesCollected,
      variantCount: variantQuantities.size,
      componentCount: componentMap.size,
    });
  }

  const transactionFeesFromTransactions = sumBy(
    transactions,
    (tx) => Math.abs(safeNumber(tx.fee ?? tx.applicationFee ?? tx.totalFees ?? 0)),
  );
  const transactionFees = transactionFeesFromTransactions + paymentCostTotal;

  const metaAdSpend = sumBy(accountMetaInsights, (insight) => safeNumber(insight.spend));
  const metaConversionValue = sumBy(
    accountMetaInsights,
    (insight) => safeNumber(insight.conversionValue),
  );

  const totalAdSpend = metaAdSpend;

  const totalCostsWithoutAds =
    cogs + shippingCosts + transactionFees + handlingCostTotal + customCostTotal + taxesCollected;
  const rtoRevenueLost = manualReturnRatePercent > 0
    ? Math.min(
        Math.max((revenue * manualReturnRatePercent) / 100, 0),
        Math.max(revenue, 0),
      )
    : 0;
  const totalReturnImpact = refundsAmount + rtoRevenueLost;
  const netProfit = revenue - totalCostsWithoutAds - totalAdSpend - totalReturnImpact;
  const grossProfit = revenue - cogs;
  const contributionProfit = revenue - (cogs + shippingCosts + transactionFees + handlingCostTotal + customCostTotal);

  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const contributionMarginPercentage = revenue > 0 ? (contributionProfit / revenue) * 100 : 0;
  const averageOrderValue = activeOrderCount > 0 ? revenue / activeOrderCount : 0;
  const averageOrderCost = activeOrderCount > 0 ? (totalCostsWithoutAds + totalAdSpend) / activeOrderCount : 0;
  const averageOrderProfit = activeOrderCount > 0 ? netProfit / activeOrderCount : 0;
  const profitPerUnit = unitsSold > 0 ? netProfit / unitsSold : 0;
  const adSpendPerOrder = activeOrderCount > 0 ? totalAdSpend / activeOrderCount : 0;
  const poas = totalAdSpend > 0 ? netProfit / totalAdSpend : 0;
  const blendedRoas = totalAdSpend > 0 ? revenue / totalAdSpend : 0;
  const metaRoas = metaAdSpend > 0 ? (metaConversionValue || revenue) / metaAdSpend : 0;
  const metaSpendPercentage = totalAdSpend > 0 ? (metaAdSpend / totalAdSpend) * 100 : 0;
  const marketingPercentageOfGross = grossSales > 0 ? (totalAdSpend / grossSales) * 100 : 0;
  const marketingPercentageOfNet = revenue > 0 ? (totalAdSpend / revenue) * 100 : 0;

  const cogsPercentageOfGross = grossSales > 0 ? (cogs / grossSales) * 100 : 0;
  const cogsPercentageOfNet = revenue > 0 ? (cogs / revenue) * 100 : 0;
  const shippingPercentageOfNet = revenue > 0 ? (shippingCosts / revenue) * 100 : 0;
  const taxesPercentageOfRevenue = revenue > 0 ? (taxesCollected / revenue) * 100 : 0;
  const fulfillmentCostPerOrder = activeOrderCount > 0 ? handlingCostTotal / activeOrderCount : 0;

  const returnRate = activeOrderCount > 0 ? (refunds.length / activeOrderCount) * 100 : 0;
  const paidCustomersCount = uniqueCustomerIds.size;
  const totalCustomersCount = customers.length > 0 ? customers.length : paidCustomersCount;
  const repeatCustomerRate = paidCustomersCount > 0 ? (returningCustomers / paidCustomersCount) * 100 : 0;
  const customerAcquisitionCost = newCustomers > 0 ? totalAdSpend / newCustomers : 0;
  const cacPercentageOfAOV = averageOrderValue > 0 ? (customerAcquisitionCost / averageOrderValue) * 100 : 0;
  const operatingCostPercentage = revenue > 0 ? (customCostTotal / revenue) * 100 : 0;

  const summary: OverviewComputation["summary"] = {
    revenue,
    revenueChange: 0,
    grossSales,
    grossSalesChange: 0,
    discounts,
    discountsChange: 0,
    discountRate: revenue > 0 ? (discounts / revenue) * 100 : 0,
    discountRateChange: 0,
    refunds: refundsAmount,
    refundsChange: 0,
    rtoRevenueLost,
    rtoRevenueLostChange: 0,
    manualReturnRate: manualReturnRatePercent,
    manualReturnRateChange: 0,
    profit: netProfit,
    profitChange: 0,
    profitMargin,
    profitMarginChange: 0,
    grossProfit,
    grossProfitChange: 0,
    grossProfitMargin,
    grossProfitMarginChange: 0,
    contributionMargin: contributionProfit,
    contributionMarginChange: 0,
    contributionMarginPercentage,
    contributionMarginPercentageChange: 0,
    operatingMargin: profitMargin,
    operatingMarginChange: 0,
    blendedMarketingCost: totalAdSpend,
    blendedMarketingCostChange: 0,
    metaAdSpend,
    metaAdSpendChange: 0,
    googleAdSpend: 0,
    googleAdSpendChange: 0,
    metaSpendPercentage,
    metaSpendPercentageChange: 0,
    marketingPercentageOfGross,
    marketingPercentageOfGrossChange: 0,
    marketingPercentageOfNet,
    marketingPercentageOfNetChange: 0,
    metaROAS: metaRoas,
    metaROASChange: 0,
    roas: blendedRoas,
    roasChange: 0,
    ncROAS: blendedRoas,
    ncROASChange: 0,
    poas,
    poasChange: 0,
    orders: activeOrderCount,
    ordersChange: 0,
    unitsSold,
    unitsSoldChange: 0,
    avgOrderValue: averageOrderValue,
    avgOrderValueChange: 0,
    avgOrderCost: averageOrderCost,
    avgOrderCostChange: 0,
    avgOrderProfit: averageOrderProfit,
    avgOrderProfitChange: 0,
    adSpendPerOrder,
    adSpendPerOrderChange: 0,
    profitPerOrder: averageOrderProfit,
    profitPerOrderChange: 0,
    profitPerUnit,
    profitPerUnitChange: 0,
    fulfillmentCostPerOrder,
    fulfillmentCostPerOrderChange: 0,
    cogs,
    cogsChange: 0,
    cogsPercentageOfGross,
    cogsPercentageOfGrossChange: 0,
    cogsPercentageOfNet,
    cogsPercentageOfNetChange: 0,
    shippingCosts,
    shippingCostsChange: 0,
    shippingPercentageOfNet,
    shippingPercentageOfNetChange: 0,
    transactionFees,
    transactionFeesChange: 0,
    handlingFees: handlingCostTotal,
    handlingFeesChange: 0,
    taxesCollected,
    taxesCollectedChange: 0,
    taxesPercentageOfRevenue,
    taxesPercentageOfRevenueChange: 0,
    customCosts: customCostTotal,
    customCostsChange: 0,
    customCostsPercentage: operatingCostPercentage,
    customCostsPercentageChange: 0,
    customers: totalCustomersCount,
    customersChange: 0,
    newCustomers,
    newCustomersChange: 0,
    returningCustomers,
    returningCustomersChange: 0,
    repeatCustomerRate,
    repeatCustomerRateChange: 0,
    customerAcquisitionCost,
    customerAcquisitionCostChange: 0,
    cacPercentageOfAOV,
    cacPercentageOfAOVChange: 0,
    returnRate,
    returnRateChange: 0,
    moMRevenueGrowth: 0,
    calendarMoMRevenueGrowth: 0,
  };

  const metrics: Record<string, MetricValue> = {
    revenue: defaultMetric(revenue, 0),
    profit: defaultMetric(netProfit, 0),
    orders: defaultMetric(activeOrderCount, 0),
    avgOrderValue: defaultMetric(averageOrderValue, 0),
    roas: defaultMetric(blendedRoas, 0),
    poas: defaultMetric(poas, 0),
    contributionMargin: defaultMetric(contributionProfit, 0),
    blendedMarketingCost: defaultMetric(totalAdSpend, 0),
    customerAcquisitionCost: defaultMetric(customerAcquisitionCost, 0),
    profitPerOrder: defaultMetric(averageOrderProfit, 0),
    rtoRevenueLost: defaultMetric(rtoRevenueLost, 0),
    manualReturnRate: defaultMetric(manualReturnRatePercent, 0),
  };

  const totalSessions = sumBy(analytics, (entry) => safeNumber(entry.sessions ?? entry.visitors ?? entry.visits));
  const totalConversions = sumBy(analytics, (entry) => safeNumber(entry.conversions ?? entry.orders ?? entry.conversion));
  const blendedSessionConversionRate = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const uniqueVisitors = sumBy(analytics, (entry) => safeNumber(entry.visitors ?? entry.sessions ?? entry.visits));

  return {
    summary,
    metrics,
    extras: {
      blendedSessionConversionRate,
      blendedSessionConversionRateChange: 0,
      uniqueVisitors,
    },
  } satisfies OverviewComputation;
}

function percentageChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) {
    if (current > 0) {
      return 100;
    }
    if (current < 0) {
      return -100;
    }
    return 0;
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(change) ? change : 0;
}

function applySummaryChanges(current: OverviewSummary, previous: OverviewSummary): void {
  const summaryRecord = current as unknown as Record<string, number>;
  for (const key of Object.keys(current) as Array<keyof OverviewSummary>) {
    if (!String(key).endsWith('Change')) continue;
    const baseKey = String(key).slice(0, -6) as keyof OverviewSummary;
    if (!(baseKey in current) || !(baseKey in previous)) continue;
    const currentValue = current[baseKey];
    const previousValue = previous[baseKey];
    if (typeof currentValue !== 'number' || typeof previousValue !== 'number') continue;
    summaryRecord[String(key)] = percentageChange(currentValue, previousValue);
  }
}

function applyMetricChanges(
  current: Record<string, MetricValue>,
  previous: Record<string, MetricValue>,
): void {
  for (const [key, metric] of Object.entries(current)) {
    const previousMetric = previous[key];
    if (!previousMetric) continue;
    metric.change = percentageChange(metric.value, previousMetric.value);
  }
}

export function computeOverviewMetrics(
  response: AnalyticsSourceResponse<any> | null | undefined,
  previousResponse?: AnalyticsSourceResponse<any> | null | undefined,
): OverviewComputation | null {
  const current = computeOverviewBaseline(response);
  if (!current) {
    return current;
  }

  if (!previousResponse) {
    return current;
  }

  const previous = computeOverviewBaseline(previousResponse);
  if (!previous) {
    return current;
  }

  applySummaryChanges(current.summary, previous.summary);
  applyMetricChanges(current.metrics, previous.metrics);
  current.extras.blendedSessionConversionRateChange = percentageChange(
    current.extras.blendedSessionConversionRate,
    previous.extras.blendedSessionConversionRate,
  );

  return current;
}

export function computePlatformMetrics(
  response: AnalyticsSourceResponse<any> | null | undefined,
): PlatformMetrics {
  if (!response) {
    return {
      shopifyConversionRate: 0,
      shopifyAbandonedCarts: 0,
      shopifyCheckoutRate: 0,
      metaSessions: 0,
      metaClicks: 0,
      metaConversion: 0,
      metaConversionRate: 0,
      metaImpressions: 0,
      metaCTR: 0,
      metaCPM: 0,
      metaReach: 0,
      metaFrequency: 0,
      metaUniqueClicks: 0,
      metaCPC: 0,
      metaCostPerConversion: 0,
      metaAddToCart: 0,
      metaInitiateCheckout: 0,
      metaPageViews: 0,
      metaViewContent: 0,
      metaLinkClicks: 0,
      metaOutboundClicks: 0,
      metaLandingPageViews: 0,
      metaVideoViews: 0,
      metaVideo3SecViews: 0,
      metaCostPerThruPlay: 0,
      blendedCPM: 0,
      blendedCPC: 0,
      blendedCTR: 0,
    } satisfies PlatformMetrics;
  }

  const data = ensureDataset(response);
  if (!data) {
    return {
      shopifyConversionRate: 0,
      shopifyAbandonedCarts: 0,
      shopifyCheckoutRate: 0,
      metaSessions: 0,
      metaClicks: 0,
      metaConversion: 0,
      metaConversionRate: 0,
      metaImpressions: 0,
      metaCTR: 0,
      metaCPM: 0,
      metaReach: 0,
      metaFrequency: 0,
      metaUniqueClicks: 0,
      metaCPC: 0,
      metaCostPerConversion: 0,
      metaAddToCart: 0,
      metaInitiateCheckout: 0,
      metaPageViews: 0,
      metaViewContent: 0,
      metaLinkClicks: 0,
      metaOutboundClicks: 0,
      metaLandingPageViews: 0,
      metaVideoViews: 0,
      metaVideo3SecViews: 0,
      metaCostPerThruPlay: 0,
      blendedCPM: 0,
      blendedCPC: 0,
      blendedCTR: 0,
    } satisfies PlatformMetrics;
  }

  const analytics = (data.analytics || []) as AnyRecord[];
  const metaInsights = (data.metaInsights || []) as AnyRecord[];

  const shopifySessions = sumBy(analytics, (entry) => safeNumber(entry.sessions ?? entry.visitors ?? entry.visits));
  const shopifyConversions = sumBy(analytics, (entry) => safeNumber(entry.conversions ?? entry.orders ?? entry.conversion));

  const metaClicks = sumBy(metaInsights, (entry) => safeNumber(entry.clicks));
  const metaUniqueClicks = sumBy(metaInsights, (entry) => safeNumber(entry.uniqueClicks));
  const metaImpressions = sumBy(metaInsights, (entry) => safeNumber(entry.impressions));
  const metaReach = sumBy(metaInsights, (entry) => safeNumber(entry.reach));
  const metaSpend = sumBy(metaInsights, (entry) => safeNumber(entry.spend));
  const metaConversions = sumBy(metaInsights, (entry) => safeNumber(entry.conversions));
  const metaAddToCart = sumBy(metaInsights, (entry) => safeNumber(entry.addToCart));
  const metaInitiateCheckout = sumBy(metaInsights, (entry) => safeNumber(entry.initiateCheckout));
  const metaPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.pageViews));
  const metaViewContent = sumBy(metaInsights, (entry) => safeNumber(entry.viewContent));
  const metaLinkClicks = sumBy(metaInsights, (entry) => safeNumber(entry.linkClicks));
  const metaOutboundClicks = sumBy(metaInsights, (entry) => safeNumber(entry.outboundClicks));
  const metaLandingPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.landingPageViews));
  const metaVideoViews = sumBy(metaInsights, (entry) => safeNumber(entry.videoViews));
  const metaVideo3SecViews = sumBy(metaInsights, (entry) => safeNumber(entry.video3SecViews));
  const metaCostPerThruPlay = sumBy(metaInsights, (entry) => safeNumber(entry.costPerThruPlay));

  const metaSessions = metaClicks || metaUniqueClicks;
  const metaConversionRate = metaClicks > 0 ? (metaConversions / metaClicks) * 100 : 0;
  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;
  const metaCPM = metaImpressions > 0 ? (metaSpend / metaImpressions) * 1000 : 0;
  const metaCPC = metaClicks > 0 ? metaSpend / metaClicks : 0;
  const metaCostPerConversion = metaConversions > 0 ? metaSpend / metaConversions : 0;
  const metaFrequency = metaReach > 0 ? metaImpressions / metaReach : 0;

  const blendedCPM = metaCPM;
  const blendedCPC = metaCPC;
  const blendedCTR = metaCTR;

  return {
    shopifyConversionRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    shopifyAbandonedCarts: Math.max(shopifySessions - shopifyConversions, 0),
    shopifyCheckoutRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    metaSessions,
    metaClicks,
    metaConversion: metaConversions,
    metaConversionRate,
    metaImpressions,
    metaCTR,
    metaCPM,
    metaReach,
    metaFrequency,
    metaUniqueClicks,
    metaCPC,
    metaCostPerConversion,
    metaAddToCart,
    metaInitiateCheckout,
    metaPageViews,
    metaViewContent,
    metaLinkClicks,
    metaOutboundClicks,
    metaLandingPageViews,
    metaVideoViews,
    metaVideo3SecViews,
    metaCostPerThruPlay,
    blendedCPM,
    blendedCPC,
    blendedCTR,
  } satisfies PlatformMetrics;
}

export function computeChannelRevenue(
  response: AnalyticsSourceResponse<any> | null | undefined,
): ChannelRevenueBreakdown {
  if (!response) {
    return { channels: [] };
  }

  const data = ensureDataset(response);
  if (!data) return { channels: [] };

  const orders = (data.orders || []) as AnyRecord[];
  const channelMap = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const rawSource =
      order.utmSource ??
      order.utm_source ??
      "Direct";
    const channel = String(rawSource || "Direct").trim() || "Direct";
    const stats = channelMap.get(channel) ?? { revenue: 0, orders: 0 };
    stats.revenue += safeNumber(order.totalPrice);
    stats.orders += 1;
    channelMap.set(channel, stats);
  }

  const channels = Array.from(channelMap.entries())
    .map(([name, stats]) => ({
      name,
      revenue: stats.revenue,
      orders: stats.orders,
      change: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return { channels };
}

export interface OrdersAnalyticsOptions {
  status?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function normaliseStatus(status?: string | null): string {
  return (status || "").toString().trim().toLowerCase();
}

function isFulfilledStatus(status?: string | null): boolean {
  const normalized = normaliseStatus(status);
  if (!normalized || normalized.includes("unfulfilled")) {
    return false;
  }

  if (
    normalized.includes("fulfilled") ||
    normalized.includes("delivered") ||
    normalized.includes("complete")
  ) {
    return true;
  }

  return false;
}

function isPartialStatus(status?: string | null): boolean {
  const normalized = normaliseStatus(status);
  return normalized.startsWith("partial");
}

function matchesStatus(order: AnalyticsOrder, status?: string): boolean {
  if (!status || status === "all") return true;
  const normalized = status.toLowerCase();
  const fulfillment = normaliseStatus(order.fulfillmentStatus);
  const financial = normaliseStatus(order.financialStatus);
  const overall = normaliseStatus(order.status);

  switch (normalized) {
    case "unfulfilled":
      return fulfillment === "" || fulfillment === "unfulfilled";
    case "partial":
      return isPartialStatus(order.fulfillmentStatus) || isPartialStatus(order.status);
    case "fulfilled":
      return isFulfilledStatus(order.fulfillmentStatus) || isFulfilledStatus(order.status);
    case "cancelled":
      return overall.includes("cancel") || financial.includes("void");
    case "refunded":
      return financial.includes("refund");
    default:
      return true;
  }
}

function matchesSearch(order: AnalyticsOrder, term?: string): boolean {
  if (!term) return true;
  const value = term.trim().toLowerCase();
  if (!value) return true;
  return (
    order.orderNumber.toLowerCase().includes(value) ||
    order.customer.name.toLowerCase().includes(value) ||
    order.customer.email.toLowerCase().includes(value)
  );
}

function sortOrders(
  orders: AnalyticsOrder[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): AnalyticsOrder[] {
  if (!sortBy) {
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const modifier = sortOrder === "asc" ? 1 : -1;

  return [...orders].sort((a, b) => {
    switch (sortBy) {
      case "revenue":
        return (a.totalPrice - b.totalPrice) * modifier;
      case "profit":
        return (a.profit - b.profit) * modifier;
      case "orders":
        return (a.items - b.items) * modifier;
      case "status":
        return a.status.localeCompare(b.status) * modifier;
      default:
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ) * modifier;
    }
  });
}

function deriveOrderDocuments(data: AnalyticsSourceData<any>): {
  orders: AnyRecord[];
  orderItems: AnyRecord[];
  transactions: AnyRecord[];
  refunds: AnyRecord[];
  variantCosts: AnyRecord[];
  variants: AnyRecord[];
} {
  return {
    orders: (data.orders || []) as AnyRecord[],
    orderItems: (data.orderItems || []) as AnyRecord[],
    transactions: (data.transactions || []) as AnyRecord[],
    refunds: (data.refunds || []) as AnyRecord[],
    variantCosts: (data.variantCosts || []) as AnyRecord[],
    variants: (data.variants || []) as AnyRecord[],
  };
}

type DerivedOrders = {
  orders: AnalyticsOrder[];
  refundedOrderIds: Set<string>;
};

function deriveAnalyticsOrders(data: AnalyticsSourceData<any>): DerivedOrders {
  const { orders, orderItems, transactions, refunds, variantCosts, variants } =
    deriveOrderDocuments(data);

  const variantMap = new Map<string, AnyRecord>();
  for (const variant of variants) {
    variantMap.set(toStringId(variant._id ?? variant.id ?? variant.variantId), variant);
  }

  const componentMap = new Map<string, AnyRecord>();
  for (const component of variantCosts) {
    const variantId = toStringId(component.variantId ?? component.variant_id);
    if (!variantId) continue;
    const current = componentMap.get(variantId);
    const currentTime = safeNumber(current?.updatedAt ?? current?.createdAt ?? 0);
    const componentTime = safeNumber(component.updatedAt ?? component.createdAt ?? 0);
    if (!current || componentTime > currentTime) {
      componentMap.set(variantId, component);
    }
  }

  const orderItemsByOrder = new Map<string, AnyRecord[]>();
  for (const item of orderItems) {
    const orderId = toStringId(item.orderId ?? item.order_id);
    if (!orderId) continue;
    const collection = orderItemsByOrder.get(orderId) ?? [];
    collection.push(item);
    orderItemsByOrder.set(orderId, collection);
  }

  const transactionsByOrder = new Map<string, AnyRecord[]>();
  for (const tx of transactions) {
    const orderId = toStringId(tx.orderId ?? tx.order_id);
    if (!orderId) continue;
    const collection = transactionsByOrder.get(orderId) ?? [];
    collection.push(tx);
    transactionsByOrder.set(orderId, collection);
  }

  const analyticsOrders: AnalyticsOrder[] = orders.map((orderRaw) => {
    const orderId = toStringId(orderRaw._id ?? orderRaw.id);
    const items = orderItemsByOrder.get(orderId) ?? [];
    const txs = transactionsByOrder.get(orderId) ?? [];

    const lineItems = items.map((item) => {
      const variantId = toStringId(item.variantId ?? item.variant_id);
      const component = componentMap.get(variantId);
      const perUnit = safeNumber(component?.cogsPerUnit ?? 0);
      return {
        id: toStringId(item._id ?? item.id ?? `${orderId}-${item.sku ?? item.title}`),
        name: String(item.title ?? item.productTitle ?? "Item"),
        quantity: safeNumber(item.quantity),
        price: safeNumber(item.price),
        cost: perUnit * safeNumber(item.quantity),
      };
    });

    const revenue = safeNumber(orderRaw.totalPrice);
    const shippingCost = safeNumber(orderRaw.shippingCosts ?? 0);
    const taxAmount = safeNumber(orderRaw.taxesCollected ?? 0);
    const cogsAmount = lineItems.reduce((total, item) => total + item.cost, 0);
    const transactionFee = txs.reduce((total, tx) => total + safeNumber(tx.fee), 0);

    const totalCost = cogsAmount + shippingCost + taxAmount + transactionFee;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const itemCount = lineItems.reduce((total, item) => total + item.quantity, 0);

    const shippingAddress =
      (orderRaw.shippingAddress as AnyRecord | undefined) ??
      (orderRaw.shipping_address as AnyRecord | undefined) ??
      {};

    const tagsArray = Array.isArray(orderRaw.tags)
      ? (orderRaw.tags as string[])
      : typeof orderRaw.tags === "string"
        ? (orderRaw.tags as string)
            .split(",")
            .map((tag: string) => tag.trim())
            .filter(Boolean)
        : [];

    const customerRecord = orderRaw.customer as AnyRecord | undefined;
    const customerNameCandidate = orderRaw.customerName ?? customerRecord?.name;
    const fallbackCustomerName = `${customerRecord?.firstName ?? ""} ${customerRecord?.lastName ?? ""}`.trim();
    const resolvedCustomerName =
      typeof customerNameCandidate === "string" && customerNameCandidate.trim().length > 0
        ? customerNameCandidate
        : fallbackCustomerName.length > 0
          ? fallbackCustomerName
          : "Customer";
    const resolvedCustomerEmail = (() => {
      const emailCandidate = orderRaw.email ?? customerRecord?.email;
      return typeof emailCandidate === "string" ? emailCandidate : "";
    })();

    const fallbackPayment =
      orderRaw.paymentMethod ??
      orderRaw.paymentGateway ??
      orderRaw.gateway ??
      orderRaw.payment_methods ??
      "";

    return {
      id: orderId,
      orderNumber: String(
        orderRaw.orderNumber ??
          orderRaw.name ??
          orderRaw.shopifyId ??
          orderId,
      ),
      customer: {
        name: String(resolvedCustomerName),
        email: String(resolvedCustomerEmail),
      },
      status: String(orderRaw.status ?? ""),
      fulfillmentStatus: String(orderRaw.fulfillmentStatus ?? ""),
      financialStatus: String(orderRaw.financialStatus ?? ""),
      items: itemCount,
      totalPrice: revenue,
      totalCost,
      profit,
      profitMargin,
      taxAmount,
      shippingCost,
      paymentMethod: String(txs[0]?.gateway ?? txs[0]?.paymentMethod ?? fallbackPayment ?? ""),
      tags: tagsArray,
      shippingAddress: {
        city: String(shippingAddress.city ?? shippingAddress.province ?? ""),
        country: String(shippingAddress.country ?? shippingAddress.countryCode ?? ""),
      },
      createdAt: new Date(
        safeNumber(orderRaw.shopifyCreatedAt ?? orderRaw.createdAt),
      ).toISOString(),
      updatedAt: new Date(
        safeNumber(orderRaw.shopifyUpdatedAt ?? orderRaw.updatedAt ?? orderRaw.shopifyCreatedAt),
      ).toISOString(),
      lineItems,
    } satisfies AnalyticsOrder;
  });

  const refundedOrders = new Set(
    refunds.map((refund) => toStringId(refund.orderId ?? refund.order_id)),
  );

  return {
    orders: analyticsOrders,
    refundedOrderIds: refundedOrders,
  } satisfies DerivedOrders;
}

type OrdersAggregateSummary = {
  totalOrders: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  totalTax: number;
  grossMargin: number;
  avgOrderValue: number;
  fulfillmentRate: number;
  avgFulfillmentCost: number;
  returnRate: number;
};

function aggregateOrdersMetrics(
  orders: AnalyticsOrder[],
  refundedOrderIds: Set<string>,
): OrdersAggregateSummary {
  let totalRevenue = 0;
  let totalCosts = 0;
  let netProfit = 0;
  let totalTax = 0;
  let shippingTotal = 0;
  let cogsTotal = 0;
  let fulfilledCount = 0;
  let returnCount = 0;

  for (const order of orders) {
    totalRevenue += order.totalPrice;
    totalCosts += order.totalCost;
    netProfit += order.profit;
    totalTax += order.taxAmount;
    shippingTotal += order.shippingCost;

    const orderCogs = order.lineItems?.reduce((sum, item) => sum + item.cost, 0) ?? 0;
    cogsTotal += orderCogs;

    if (isFulfilledStatus(order.fulfillmentStatus)) {
      fulfilledCount += 1;
    }

    if (refundedOrderIds.has(order.id)) {
      returnCount += 1;
    }
  }

  const totalOrders = orders.length;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - cogsTotal) / totalRevenue) * 100 : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const fulfillmentRate = totalOrders > 0 ? (fulfilledCount / totalOrders) * 100 : 0;
  const avgFulfillmentCost = totalOrders > 0 ? shippingTotal / totalOrders : 0;
  const returnRate = totalOrders > 0 ? (returnCount / totalOrders) * 100 : 0;

  return {
    totalOrders,
    totalRevenue,
    totalCosts,
    netProfit,
    totalTax,
    grossMargin,
    avgOrderValue,
    fulfillmentRate,
    avgFulfillmentCost,
    returnRate,
  } satisfies OrdersAggregateSummary;
}

export function computeOrdersAnalytics(
  response: AnalyticsSourceResponse<any> | null | undefined,
  options: OrdersAnalyticsOptions = {},
  previousResponse?: AnalyticsSourceResponse<any> | null | undefined,
): OrdersAnalyticsResult {
  if (!response) {
    return {
      overview: null,
      orders: null,
      fulfillment: null,
      exportRows: [],
    } satisfies OrdersAnalyticsResult;
  }

  const data = ensureDataset(response);
  if (!data) {
    return {
      overview: null,
      orders: null,
      fulfillment: null,
      exportRows: [],
    } satisfies OrdersAnalyticsResult;
  }

  const { orders: analyticsOrders, refundedOrderIds } = deriveAnalyticsOrders(data);

  const filtered = analyticsOrders.filter(
    (order) => matchesStatus(order, options.status) && matchesSearch(order, options.searchTerm),
  );

  const sorted = sortOrders(filtered, options.sortBy, options.sortOrder ?? "desc");

  const total = sorted.length;
  const pageSize = Math.max(1, options.pageSize ?? 50);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(options.page ?? 1, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  const aggregates = aggregateOrdersMetrics(sorted, refundedOrderIds);

  let previousAggregates: OrdersAggregateSummary | null = null;
  if (previousResponse) {
    const previousData = ensureDataset(previousResponse);
    if (previousData) {
      const { orders: previousOrders, refundedOrderIds: previousRefunded } =
        deriveAnalyticsOrders(previousData);
      const previousFiltered = previousOrders.filter(
        (order) => matchesStatus(order, options.status) && matchesSearch(order, options.searchTerm),
      );
      previousAggregates = aggregateOrdersMetrics(previousFiltered, previousRefunded);
    }
  }

  const overview: OrdersOverviewMetrics = {
    totalOrders: aggregates.totalOrders,
    totalRevenue: aggregates.totalRevenue,
    totalCosts: aggregates.totalCosts,
    netProfit: aggregates.netProfit,
    totalTax: aggregates.totalTax,
    avgOrderValue: aggregates.avgOrderValue,
    customerAcquisitionCost: 0,
    grossMargin: aggregates.grossMargin,
    fulfillmentRate: aggregates.fulfillmentRate,
    changes: {
      totalOrders: percentageChange(
        aggregates.totalOrders,
        previousAggregates?.totalOrders ?? 0,
      ),
      revenue: percentageChange(
        aggregates.totalRevenue,
        previousAggregates?.totalRevenue ?? 0,
      ),
      netProfit: percentageChange(
        aggregates.netProfit,
        previousAggregates?.netProfit ?? 0,
      ),
      avgOrderValue: percentageChange(
        aggregates.avgOrderValue,
        previousAggregates?.avgOrderValue ?? 0,
      ),
      cac: percentageChange(0, 0),
      margin: percentageChange(
        aggregates.grossMargin,
        previousAggregates?.grossMargin ?? 0,
      ),
      fulfillmentRate: percentageChange(
        aggregates.fulfillmentRate,
        previousAggregates?.fulfillmentRate ?? 0,
      ),
    },
  };

  const fulfillment: OrdersFulfillmentMetrics = {
    avgProcessingTime: 0,
    avgShippingTime: 0,
    avgDeliveryTime: 0,
    onTimeDeliveryRate: overview.fulfillmentRate,
    fulfillmentAccuracy: overview.fulfillmentRate,
    returnRate: aggregates.returnRate,
    avgFulfillmentCost: aggregates.avgFulfillmentCost,
    totalOrders: aggregates.totalOrders,
  };

  const exportRows: OrdersAnalyticsExportRow[] = sorted.map((order) => ({
    "Order Number": order.orderNumber,
    Customer: order.customer.name,
    Email: order.customer.email,
    Status: order.status,
    "Fulfillment Status": order.fulfillmentStatus,
    "Financial Status": order.financialStatus,
    Items: order.items,
    Revenue: order.totalPrice,
    Costs: order.totalCost,
    Profit: order.profit,
    "Profit Margin": order.profitMargin,
    Shipping: order.shippingCost,
    Tax: order.taxAmount,
    Payment: order.paymentMethod,
    "Ship To": `${order.shippingAddress.city}, ${order.shippingAddress.country}`.trim(),
    "Created At": order.createdAt,
    "Updated At": order.updatedAt,
  }));

  return {
    overview,
    orders: {
      data: paginated,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
      },
    },
    fulfillment,
    exportRows,
  } satisfies OrdersAnalyticsResult;
}

function getPeriodKey(date: Date, granularity: PnLGranularity) {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  switch (granularity) {
    case "weekly": {
      const current = new Date(base.getTime());
      const day = current.getUTCDay() || 7;
      if (day !== 1) {
        current.setUTCDate(current.getUTCDate() - day + 1);
      }

      const endLabelDate = new Date(current.getTime());
      endLabelDate.setUTCDate(endLabelDate.getUTCDate() + 6);

      const endRange = new Date(endLabelDate.getTime());
      endRange.setUTCHours(23, 59, 59, 999);

      const startIso = current.toISOString().slice(0, 10);
      const endIso = endLabelDate.toISOString().slice(0, 10);

      return {
        key: `${startIso}_${endIso}`,
        label: `${startIso} – ${endIso}`,
        date: startIso,
        rangeStartMs: current.getTime(),
        rangeEndMs: endRange.getTime(),
      };
    }
    case "monthly": {
      const year = base.getUTCFullYear();
      const monthIndex = base.getUTCMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

      const start = new Date(Date.UTC(year, monthIndex, 1));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

      return {
        key,
        label: key,
        date: `${key}-01`,
        rangeStartMs: start.getTime(),
        rangeEndMs: end.getTime(),
      };
    }
    case "daily":
    default: {
      const start = new Date(base.getTime());
      const end = new Date(base.getTime());
      end.setUTCHours(23, 59, 59, 999);
      const iso = start.toISOString().slice(0, 10);
      return {
        key: iso,
        label: iso,
        date: iso,
        rangeStartMs: start.getTime(),
        rangeEndMs: end.getTime(),
      };
    }
  }
}

function aggregatePnLMetrics(items: AnyRecord[]): PnLMetrics {
  return {
    grossSales: sumBy(items, (item) => safeNumber(item.grossSales ?? item.totalSales ?? item.sales)),
    discounts: sumBy(items, (item) => safeNumber(item.discounts ?? item.totalDiscounts ?? 0)),
    refunds: sumBy(items, (item) => safeNumber(item.refunds ?? item.totalRefunds ?? 0)),
    rtoRevenueLost: sumBy(items, (item) => safeNumber(item.rtoRevenueLost ?? 0)),
    revenue: sumBy(items, (item) => safeNumber(item.revenue ?? item.netSales ?? item.totalPrice ?? 0)),
    cogs: sumBy(items, (item) => safeNumber(item.cogs ?? item.totalCostOfGoods ?? 0)),
    shippingCosts: sumBy(items, (item) => safeNumber(item.shippingCosts ?? item.totalShipping ?? 0)),
    transactionFees: sumBy(items, (item) => safeNumber(item.transactionFees ?? item.totalFees ?? 0)),
    handlingFees: sumBy(items, (item) => safeNumber(item.handlingFees ?? 0)),
    grossProfit: sumBy(items, (item) => safeNumber(item.grossProfit ?? 0)),
    taxesCollected: sumBy(items, (item) => safeNumber(item.taxesCollected ?? item.tax ?? 0)),
    customCosts: sumBy(items, (item) => safeNumber(item.customCosts ?? item.operatingCosts ?? 0)),
    totalAdSpend: sumBy(items, (item) => safeNumber(item.totalAdSpend ?? item.marketingCosts ?? 0)),
    netProfit: sumBy(items, (item) => safeNumber(item.netProfit ?? item.profit ?? 0)),
    netProfitMargin: 0,
  } satisfies PnLMetrics;
}

function finalisePnLMetrics(metrics: PnLMetrics): PnLMetrics {
  const netMargin = metrics.revenue > 0 ? (metrics.netProfit / metrics.revenue) * 100 : 0;
  return {
    ...metrics,
    netProfitMargin: netMargin,
  };
}

type CostComputationContext = {
  ordersCount: number;
  unitsSold: number;
  revenue: number;
  rangeStartMs: number;
  rangeEndMs: number;
};

function toCostMode(cost: AnyRecord): "fixed" | "perOrder" | "perUnit" | "percentageRevenue" | "timeBound" {
  // Schema has calculation and frequency as separate fields
  const freq = String(cost.frequency ?? "");
  const calc = String(cost.calculation ?? "fixed");

  // Check frequency first for per_order/per_unit patterns
  if (freq === "per_order") return "perOrder";
  if (freq === "per_unit" || freq === "per_item") return "perUnit";

  // Then check calculation for percentage and other modes
  if (calc === "percentage") return "percentageRevenue";
  if (calc === "per_unit") return "perUnit";

  // Default to fixed for monthly, yearly, one_time frequencies
  return "fixed";
}

function computeCostAmountForRange(cost: AnyRecord, ctx: CostComputationContext): number {
  // Schema uses 'value' field, not 'amount'
  const amount = safeNumber(cost.value ?? cost.amount ?? cost.total ?? 0);
  if (amount === 0) return 0;

  const mode = toCostMode(cost);
  const { overlapMs, windowMs } = computeCostOverlap(cost, ctx.rangeStartMs, ctx.rangeEndMs);
  if (overlapMs <= 0) {
    return 0;
  }

  const frequencyDuration = getFrequencyDurationMs(cost);

  switch (mode) {
    case "perOrder":
      return amount * ctx.ordersCount;
    case "perUnit":
      return amount * ctx.unitsSold;
    case "percentageRevenue":
      return ctx.revenue > 0 ? (amount / 100) * ctx.revenue : 0;
    case "timeBound": {
      if (windowMs && windowMs > 0) {
        return amount * (overlapMs / windowMs);
      }
      if (frequencyDuration) {
        return amount * (overlapMs / frequencyDuration);
      }
      return amount;
    }
    case "fixed":
    default:
      if (frequencyDuration) {
        return amount * (overlapMs / frequencyDuration);
      }
      return amount;
  }
}

function calculatePnLMetricsForRange({
  orders,
  costs,
  manualReturnRates,
  metaInsights,
  rangeStartMs,
  rangeEndMs,
}: {
  orders: AnyRecord[];
  costs: AnyRecord[];
  manualReturnRates: AnyRecord[];
  metaInsights: AnyRecord[];
  rangeStartMs: number;
  rangeEndMs: number;
}): { metrics: PnLMetrics; marketingCost: number } {
  const filteredOrders = orders.filter((order) => {
    const createdAt = safeNumber(order.shopifyCreatedAt ?? order.createdAt ?? order.processedAt ?? 0);
    if (!Number.isFinite(createdAt)) return false;
    if (Number.isFinite(rangeStartMs) && createdAt < rangeStartMs) return false;
    if (Number.isFinite(rangeEndMs) && createdAt > rangeEndMs) return false;
    return true;
  });

  const grossSales = sumBy(filteredOrders, (order) =>
    safeNumber(order.subtotalPrice ?? order.totalSales ?? order.totalPrice ?? 0),
  );
  const revenue = sumBy(filteredOrders, (order) => safeNumber(order.totalPrice ?? order.revenue ?? 0));
  const discounts = sumBy(filteredOrders, (order) => safeNumber(order.totalDiscounts ?? order.discounts ?? 0));
  const refunds = sumBy(filteredOrders, (order) => safeNumber(order.totalRefunded ?? order.totalRefunds ?? 0));
  const cogs = sumBy(filteredOrders, (order) => safeNumber(order.totalCostOfGoods ?? order.cogs ?? 0));
  let shippingCosts = sumBy(filteredOrders, (order) => safeNumber(order.shippingCosts ?? 0));
  let transactionFees = sumBy(filteredOrders, (order) => safeNumber(order.totalFees ?? order.transactionFees ?? 0));
  const handlingFees = sumBy(filteredOrders, (order) => safeNumber(order.handlingFees ?? 0));
  const taxesCollected = sumBy(filteredOrders, (order) => safeNumber(order.taxesCollected ?? 0));

  const unitsSold = sumBy(filteredOrders, (order) =>
    safeNumber(
      order.totalQuantity ??
        order.totalQuantityOrdered ??
        order.totalItems ??
        order.unitsSold ??
        0,
    ),
  );

  const context: CostComputationContext = {
    ordersCount: filteredOrders.length,
    unitsSold,
    revenue,
    rangeStartMs,
    rangeEndMs,
  };

  const shippingCostEntries = costs.filter((cost) => cost.type === "shipping");
  const paymentCostEntries = costs.filter((cost) => cost.type === "payment");
  const operationalCostEntries = costs.filter((cost) => {
    const type = String(cost.type ?? "");
    return type === "operational" || type === "custom";
  });
 
  shippingCosts += sumBy(shippingCostEntries, (cost) => computeCostAmountForRange(cost, context));
  transactionFees += sumBy(paymentCostEntries, (cost) => computeCostAmountForRange(cost, context));
  const operationalCostsAmount = sumBy(operationalCostEntries, (cost) => computeCostAmountForRange(cost, context));

  const accountMetaInsights = filterAccountLevelMetaInsights(metaInsights);
  const metaSpend = sumBy(accountMetaInsights, (insight) => {
    if (!insight || typeof insight.date !== "string") return 0;
    const timestamp = Date.parse(`${insight.date}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp)) return 0;
    if (Number.isFinite(rangeStartMs) && timestamp < rangeStartMs) return 0;
    if (Number.isFinite(rangeEndMs) && timestamp > rangeEndMs) return 0;
    return safeNumber(insight.spend ?? 0);
  });

  const totalAdSpend = metaSpend;
  const customCosts = operationalCostsAmount;

  const manualRateWindow = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs)
    ? { start: rangeStartMs, end: rangeEndMs }
    : undefined;
  const manualReturnRatePercent = resolveManualReturnRate(manualReturnRates, manualRateWindow).ratePercent;
  const rtoRevenueLost = manualReturnRatePercent > 0
    ? Math.min(
        Math.max((revenue * manualReturnRatePercent) / 100, 0),
        Math.max(revenue, 0),
      )
    : 0;

  const netRevenue = revenue - refunds - rtoRevenueLost;
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - (shippingCosts + transactionFees + handlingFees + taxesCollected + customCosts + totalAdSpend);

  const metrics = finalisePnLMetrics({
    grossSales,
    discounts,
    refunds,
    rtoRevenueLost,
    revenue: netRevenue,
    cogs,
    shippingCosts,
    transactionFees,
    handlingFees,
    grossProfit,
    taxesCollected,
    customCosts,
    totalAdSpend,
    netProfit,
    netProfitMargin: 0,
  });

  return {
    metrics,
    marketingCost: totalAdSpend,
  };
}

function buildPnLKPIs(total: PnLMetrics, marketingCost: number): PnLKPIMetrics {
  const netRevenue = total.revenue;
  const operatingExpenses = total.customCosts;
  const ebitda = total.netProfit + total.totalAdSpend + total.customCosts;
  const marketingROAS = marketingCost > 0 ? total.revenue / marketingCost : 0;
  const marketingROI = marketingCost > 0 ? (total.netProfit / marketingCost) * 100 : 0;

  return {
    grossSales: total.grossSales,
    discountsReturns: total.discounts + total.refunds + total.rtoRevenueLost,
    netRevenue,
    grossProfit: total.grossProfit,
    operatingExpenses,
    ebitda,
    netProfit: total.netProfit,
    netMargin: total.netProfitMargin,
    marketingCost: marketingCost,
    marketingROAS,
    marketingROI,
    changes: {
      grossSales: 0,
      discountsReturns: 0,
      netRevenue: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      ebitda: 0,
      netProfit: 0,
      netMargin: 0,
      marketingCost: 0,
      marketingROAS: 0,
      marketingROI: 0,
    },
  } satisfies PnLKPIMetrics;
}

export function computePnLAnalytics(
  response: AnalyticsSourceResponse<any> | null | undefined,
  granularity: PnLGranularity,
): PnLAnalyticsResult {
  const emptyTotals = finalisePnLMetrics(aggregatePnLMetrics([]));
  if (!response) {
    return { metrics: null, periods: [], exportRows: [], totals: emptyTotals } satisfies PnLAnalyticsResult;
  }

  const data = ensureDataset(response);
  if (!data) {
    return { metrics: null, periods: [], exportRows: [], totals: emptyTotals } satisfies PnLAnalyticsResult;
  }

  const orders = (data.orders || []) as AnyRecord[];
  const costs = (data.globalCosts || []) as AnyRecord[];
  const manualReturnRates = (data.manualReturnRates || []) as AnyRecord[];
  const metaInsights = (data.metaInsights || []) as AnyRecord[];
  const buckets = new Map<
    string,
    {
      label: string;
      date: string;
      rangeStartMs: number;
      rangeEndMs: number;
      orders: AnyRecord[];
    }
  >();

  const ensureBucket = (dateValue: Date) => {
    const period = getPeriodKey(dateValue, granularity);
    const existing = buckets.get(period.key);
    if (existing) return existing;
    const bucket = {
      label: period.label,
      date: period.date,
      rangeStartMs: period.rangeStartMs,
      rangeEndMs: period.rangeEndMs,
      orders: [] as AnyRecord[],
    };
    buckets.set(period.key, bucket);
    return bucket;
  };

  for (const order of orders) {
    const createdAt = safeNumber(order.shopifyCreatedAt ?? order.createdAt ?? order.processedAt ?? Date.now());
    if (!Number.isFinite(createdAt)) continue;
    const bucket = ensureBucket(new Date(createdAt));
    bucket.orders.push(order);
  }

  for (const insight of metaInsights) {
    if (!insight || typeof insight.date !== "string") continue;
    const parsed = Date.parse(`${insight.date}T00:00:00.000Z`);
    if (!Number.isFinite(parsed)) continue;
    ensureBucket(new Date(parsed));
  }

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.rangeStartMs - b.rangeStartMs);

  const totalRangeStart = response.dateRange?.startDate
    ? Date.parse(`${response.dateRange.startDate}T00:00:00.000Z`)
    : Number.NEGATIVE_INFINITY;
  const totalRangeEnd = response.dateRange?.endDate
    ? Date.parse(`${response.dateRange.endDate}T23:59:59.999Z`)
    : Number.POSITIVE_INFINITY;

  const totalComputation = calculatePnLMetricsForRange({
    orders,
    costs,
    manualReturnRates,
    metaInsights,
    rangeStartMs: totalRangeStart,
    rangeEndMs: totalRangeEnd,
  });

  const periods: PnLTablePeriod[] = sortedBuckets.map((bucket) => {
    const { metrics } = calculatePnLMetricsForRange({
      orders: bucket.orders,
      costs,
      manualReturnRates,
      metaInsights,
      rangeStartMs: bucket.rangeStartMs,
      rangeEndMs: bucket.rangeEndMs,
    });

    return {
      label: bucket.label,
      date: bucket.date,
      metrics,
      growth: null,
    } satisfies PnLTablePeriod;
  });

  if (periods.length > 0) {
    periods.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    periods.push({
      label: "Total",
      date: response.dateRange?.endDate ?? new Date().toISOString().slice(0, 10),
      metrics: totalComputation.metrics,
      growth: null,
      isTotal: true,
    });
  }

  const kpis = buildPnLKPIs(totalComputation.metrics, totalComputation.metrics.totalAdSpend);

  const regularPeriods = periods.filter((period) => !period.isTotal);
  const exportRows = regularPeriods.map((period) => ({
    Period: period.label,
    NetRevenue: period.metrics.revenue,
    Discounts: period.metrics.discounts,
    Returns: period.metrics.refunds,
    COGS: period.metrics.cogs,
    Shipping: period.metrics.shippingCosts,
    TransactionFees: period.metrics.transactionFees,
    HandlingFees: period.metrics.handlingFees,
    GrossProfit: period.metrics.grossProfit,
    Taxes: period.metrics.taxesCollected,
    OperatingCosts: period.metrics.customCosts,
    AdSpend: period.metrics.totalAdSpend,
    NetProfit: period.metrics.netProfit,
    NetMargin: period.metrics.netProfitMargin,
  }));

  exportRows.push({
    Period: "TOTAL",
    NetRevenue: totalComputation.metrics.revenue,
    Discounts: totalComputation.metrics.discounts,
    Returns: totalComputation.metrics.refunds,
    COGS: totalComputation.metrics.cogs,
    Shipping: totalComputation.metrics.shippingCosts,
    TransactionFees: totalComputation.metrics.transactionFees,
    HandlingFees: totalComputation.metrics.handlingFees,
    GrossProfit: totalComputation.metrics.grossProfit,
    Taxes: totalComputation.metrics.taxesCollected,
    OperatingCosts: totalComputation.metrics.customCosts,
    AdSpend: totalComputation.metrics.totalAdSpend,
    NetProfit: totalComputation.metrics.netProfit,
    NetMargin: totalComputation.metrics.netProfitMargin,
  });

  return {
    metrics: kpis,
    periods,
    exportRows,
    totals: totalComputation.metrics,
  } satisfies PnLAnalyticsResult;
}

export function isDatasetEmpty(
  response: AnalyticsSourceResponse<any> | undefined | null,
  datasets?: readonly AnalyticsDatasetKey[],
): boolean {
  if (!response) return true;
  const data = ensureDataset(response);
  if (!data) return true;

  const keys = datasets ?? (Object.keys(data) as AnalyticsDatasetKey[]);
  return keys.every((key) => (data[key]?.length ?? 0) === 0);
}
