import type {
  AnalyticsSourceResponse,
  MetricValue,
  OverviewComputation,
  OverviewSummary,
} from '@repo/types';

import type { AnyRecord } from './shared';
import {
  computeCostOverlap,
  defaultMetric,
  ensureDataset,
  filterAccountLevelMetaInsights,
  getFrequencyDurationMs,
  parseDateBoundary,
  percentageChange,
  resolveManualReturnRate,
  safeNumber,
  sumBy,
  toStringId,
} from './shared';

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

  // Use global costs primarily, fallback to order-level only if global costs are zero
  shippingCosts = shippingCostTotal > 0 ? shippingCostTotal : shippingCostsFromOrders;

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
  const operatingProfit = revenue - totalCostsWithoutAds - totalReturnImpact;
  const grossProfit = revenue - cogs;
  const contributionProfit = revenue - (cogs + shippingCosts + transactionFees + handlingCostTotal + customCostTotal);

  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;
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
    operatingMargin,
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
