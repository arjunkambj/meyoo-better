import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";

import type { MetricCategory, MetricDefinition } from "./types";

export const METRIC_CATEGORIES: Record<string, MetricCategory> = {
  coreKPIs: {
    id: "coreKPIs",
    name: "Home Dashboard (10)",
    icon: "solar:chart-2-bold-duotone",
    metrics: [
      // kpi.md — Home Dashboard (10)
      "netProfit",              // Net Profit
      "revenue",               // Revenue (Net)
      "netProfitMargin",       // Profit Margin %
      "orders",                // Orders
      "avgOrderValue",         // AOV
      "blendedRoas",           // ROAS (Revenue ÷ Total Ad Spend)
      "totalAdSpend",          // Total Ad Spend
      "shopifyConversionRate", // Conversion Rate (Overall)
      "repeatCustomerRate",    // Returning Customers % (proxy for New vs Returning)
      "moMRevenueGrowth",      // MoM Revenue Growth
    ],
  },
  revenue: {
    id: "revenue",
    name: "Profit & Cost Stack",
    icon: "solar:dollar-circle-bold-duotone",
    metrics: [
      "discounts",
      "refunds",
      "returns",
      "returnRate",
      "grossProfit",
      "grossProfitMargin",
      "contributionMargin",
      "operatingMargin",
      "shippingCharged",
      "cogs",
      "transactionFees",
      "taxesCollected",
    ],
  },
  trafficConversion: {
    id: "trafficConversion",
    name: "Storefront Funnel",
    icon: "solar:users-group-two-rounded-bold-duotone",
    metrics: [
      "uniqueVisitors",
      "metaClicks",
      "shopifyConversionRate",
      "metaConversionRate",
      "blendedSessionConversionRate",
      "shopifyAbandonedCarts",
      "shopifyCheckoutRate",
    ],
  },
  marketing: {
    id: "marketing",
    name: "Acquisition (Blended)",
    icon: "solar:ad-bold-duotone",
    metrics: [
      "metaAdSpend",
      "marketingPercentageOfNet",
      "metaROAS",
      "blendedCPM",
      "blendedCPC",
      "blendedCTR",
      "adSpendPerOrder",
    ],
  },
  metaInsights: {
    id: "metaInsights",
    name: "Channel — Meta Ads",
    icon: "logos:meta-icon",
    metrics: [
      "metaReach",
      "metaImpressions",
      "metaFrequency",
      "metaUniqueClicks",
      "metaCTR",
      "metaCPC",
      "metaCostPerConversion",
      "metaAddToCart",
      "metaInitiateCheckout",
      "metaPageViews",
      "metaLinkClicks",
      "metaOutboundClicks",
      "metaLandingPageViews",
      "metaVideoViews",
      "metaVideo3SecViews",
      "metaCostPerThruPlay",
    ],
  },
  costStructure: {
    id: "costStructure",
    name: "Cost Structure",
    icon: "solar:wallet-bold-duotone",
    metrics: [
      "cogs",
      "cogsPercentageOfNet",
      "shippingCosts",
      "shippingPercentageOfNet",
      "transactionFees",
      "taxesCollected",
      "handlingFees",
      "customCosts",
      "customCostsPercentage",
    ],
  },
  customerEconomics: {
    id: "customerEconomics",
    name: "Customers & Retention",
    icon: "solar:users-group-rounded-bold-duotone",
    metrics: [
      "totalCustomers",
      "newCustomers",
      "returningCustomers",
      "repeatCustomerRate",
      "cacPaybackPeriod",
      "ltvToCACRatio",
    ],
  },
  unitEconomics: {
    id: "unitEconomics",
    name: "Unit Economics",
    icon: "solar:box-minimalistic-bold-duotone",
    metrics: [
      "unitsSold",
      "avgOrderProfit",
      "profitPerOrder",
      "profitPerUnit",
      "fulfillmentCostPerOrder",
    ],
  },
  operationalEfficiency: {
    id: "operationalEfficiency",
    name: "Operations",
    icon: "solar:settings-bold-duotone",
    metrics: [
      "inventoryTurnover",
      "returnRate",
      "returnProcessingCost",
      "refundRate",
      "cancelledOrderRate",
    ],
  },
  growthMetrics: {
    id: "growthMetrics",
    name: "Growth",
    icon: "solar:graph-up-new-bold-duotone",
    metrics: [
      "moMRevenueGrowth",
      "calendarMoMRevenueGrowth",
    ],
  },
};

export const METRICS: Record<string, MetricDefinition> = {
  // Key Performance Indicators
  revenue: {
    id: "revenue",
    label: "Revenue (Net)",
    icon: "solar:money-bag-bold-duotone",
    category: "coreKPIs",
    format: "currency",
    prefix: "$",
    description: "Total revenue",
  },
  netProfit: {
    id: "netProfit",
    label: "Net Profit",
    icon: "solar:graph-up-bold-duotone",
    category: "coreKPIs",
    format: "currency",
    prefix: "$",
    description: "Net profit after all costs",
  },
  netProfitMargin: {
    id: "netProfitMargin",
    label: "Profit Margin",
    icon: "solar:chart-square-bold-duotone",
    category: "coreKPIs",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Net profit margin percentage",
  },
  orders: {
    id: "orders",
    label: "Orders",
    icon: "solar:bag-4-bold-duotone",
    category: "coreKPIs",
    format: "number",
    description: "Total number of orders",
  },
  avgOrderValue: {
    id: "avgOrderValue",
    label: "AOV",
    icon: "solar:wallet-bold-duotone",
    category: "coreKPIs",
    format: "currency",
    prefix: "$",
    description: "Average order value",
  },
  blendedRoas: {
    id: "blendedRoas",
    label: "ROAS",
    icon: "solar:graph-up-bold-duotone",
    category: "coreKPIs",
    format: "decimal",
    decimal: 2,
    description: "ROAS (blended) = Revenue ÷ Total Ad Spend",
  },

  // Revenue & Margins
  grossSales: {
    id: "grossSales",
    label: "Gross Sales",
    icon: "solar:sale-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Total gross sales",
  },
  discounts: {
    id: "discounts",
    label: "Discounts",
    icon: "solar:tag-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Total discounts given",
  },
  discountRate: {
    id: "discountRate",
    label: "Discount Rate",
    icon: "solar:percent-bold-duotone",
    category: "revenue",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Discount percentage of gross",
  },
  refunds: {
    id: "refunds",
    label: "Refunds",
    icon: "solar:card-recive-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Total refunds issued",
  },
  returns: {
    id: "returns",
    label: "Returns",
    icon: "solar:rewind-back-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Total returns value",
  },
  grossProfit: {
    id: "grossProfit",
    label: "Gross Profit",
    icon: "solar:profit-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Gross profit",
  },
  grossProfitMargin: {
    id: "grossProfitMargin",
    label: "Gross Margin",
    icon: "solar:chart-square-bold-duotone",
    category: "revenue",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Gross profit margin",
  },
  contributionMargin: {
    id: "contributionMargin",
    label: "Contribution Margin",
    icon: "solar:wallet-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Contribution margin",
  },
  contributionMarginPercentage: {
    id: "contributionMarginPercentage",
    label: "Contribution %",
    icon: "solar:percent-bold-duotone",
    category: "revenue",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Contribution margin percentage",
  },
  operatingMargin: {
    id: "operatingMargin",
    label: "Operating Margin",
    icon: "solar:chart-2-bold-duotone",
    category: "revenue",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Operating margin",
  },
  shippingCharged: {
    id: "shippingCharged",
    label: "Shipping Revenue",
    icon: "solar:delivery-bold-duotone",
    category: "revenue",
    format: "currency",
    prefix: "$",
    description: "Shipping fees charged to customers",
  },

  // Sessions & Traffic
  uniqueVisitors: {
    id: "uniqueVisitors",
    label: "Unique Visitors",
    icon: "solar:user-bold-duotone",
    category: "trafficConversion",
    format: "number",
    description: "Unique website visitors",
  },
  shopifySessions: {
    id: "shopifySessions",
    label: "Shopify Sessions",
    icon: "simple-icons:shopify",
    category: "trafficConversion",
    format: "number",
    description: "Total store sessions from Shopify",
    iconColor: "text-green-600",
  },
  metaClicks: {
    id: "metaClicks",
    label: "Meta Clicks",
    icon: "logos:meta-icon",
    category: "trafficConversion",
    format: "number",
    description: "Clicks from Meta ads",
  },
  shopifyConversionRate: {
    id: "shopifyConversionRate",
    label: "Conversion Rate (Overall)",
    icon: "simple-icons:shopify",
    category: "trafficConversion",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Orders ÷ Sessions × 100 (Shopify)",
    iconColor: "text-green-600",
  },
  metaConversionRate: {
    id: "metaConversionRate",
    label: "Meta Conversion",
    icon: "logos:meta-icon",
    category: "trafficConversion",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Meta ads conversion rate",
  },
  blendedSessionConversionRate: {
    id: "blendedSessionConversionRate",
    label: "Overall Session Conversion",
    icon: "solar:chart-2-bold-duotone",
    category: "trafficConversion",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Blended sessions → purchase rate",
  },
  shopifyAbandonedCarts: {
    id: "shopifyAbandonedCarts",
    label: "Abandoned Carts",
    icon: "solar:cart-cross-bold-duotone",
    category: "trafficConversion",
    format: "number",
    description: "Number of abandoned carts",
  },
  shopifyCheckoutRate: {
    id: "shopifyCheckoutRate",
    label: "Checkout Rate",
    icon: "solar:cart-check-bold-duotone",
    category: "trafficConversion",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Checkout completion rate",
  },

  // Marketing Analytics
  totalAdSpend: {
    id: "totalAdSpend",
    label: "Total Ad Spend",
    icon: "solar:ad-bold-duotone",
    category: "marketing",
    format: "currency",
    prefix: "$",
    description: "Total advertising spend",
  },
  metaAdSpend: {
    id: "metaAdSpend",
    label: "Meta Ad Spend",
    icon: "solar:facebook-bold-duotone",
    category: "marketing",
    format: "currency",
    prefix: "$",
    description: "Meta advertising spend",
  },
  metaSpendPercentage: {
    id: "metaSpendPercentage",
    label: "Meta % of Ad Spend",
    icon: "solar:percent-bold-duotone",
    category: "marketing",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Meta percentage of total ad spend",
  },
  marketingPercentageOfGross: {
    id: "marketingPercentageOfGross",
    label: "Marketing % of Gross",
    icon: "solar:percent-bold-duotone",
    category: "marketing",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Marketing as percentage of gross sales",
  },
  marketingPercentageOfNet: {
    id: "marketingPercentageOfNet",
    label: "Marketing % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "marketing",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Marketing as percentage of revenue",
  },
  metaROAS: {
    id: "metaROAS",
    label: "Meta ROAS",
    icon: "solar:graph-up-bold-duotone",
    category: "marketing",
    format: "decimal",
    decimal: 2,
    description: "Meta return on ad spend",
  },
  blendedCPM: {
    id: "blendedCPM",
    label: "Blended CPM",
    icon: "solar:eye-bold-duotone",
    category: "marketing",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Cost per thousand impressions",
  },
  blendedCPC: {
    id: "blendedCPC",
    label: "Blended CPC",
    icon: "solar:cursor-bold-duotone",
    category: "marketing",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Cost per click",
  },
  blendedCTR: {
    id: "blendedCTR",
    label: "Blended CTR",
    icon: "solar:cursor-square-bold-duotone",
    category: "marketing",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Click-through rate",
  },
  blendedConversionRate: {
    id: "blendedConversionRate",
    label: "Blended Conv Rate",
    icon: "solar:target-bold-duotone",
    category: "marketing",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Overall conversion rate",
  },
  adSpendPerOrder: {
    id: "adSpendPerOrder",
    label: "Ad Spend/Order",
    icon: "solar:bag-3-bold-duotone",
    category: "marketing",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Ad spend per order",
  },

  // Meta Analytics
  metaReach: {
    id: "metaReach",
    label: "Meta Reach",
    icon: "solar:users-group-rounded-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Unique people reached",
  },
  metaImpressions: {
    id: "metaImpressions",
    label: "Meta Impressions",
    icon: "solar:eye-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Total Meta ad impressions",
  },
  metaFrequency: {
    id: "metaFrequency",
    label: "Meta Frequency",
    icon: "solar:repeat-bold-duotone",
    category: "metaInsights",
    format: "decimal",
    decimal: 1,
    description: "Average frequency",
  },
  metaUniqueClicks: {
    id: "metaUniqueClicks",
    label: "Meta Unique Clicks",
    icon: "solar:cursor-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Unique link clicks",
  },
  metaCTR: {
    id: "metaCTR",
    label: "Meta CTR",
    icon: "solar:cursor-square-bold-duotone",
    category: "metaInsights",
    format: "percentage",
    suffix: "%",
    decimal: 2,
    description: "Meta click-through rate",
  },
  metaCPC: {
    id: "metaCPC",
    label: "Meta CPC",
    icon: "solar:dollar-circle-bold-duotone",
    category: "metaInsights",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Meta cost per click",
  },
  metaCostPerConversion: {
    id: "metaCostPerConversion",
    label: "Meta Cost/Conv",
    icon: "solar:target-bold-duotone",
    category: "metaInsights",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Meta cost per conversion",
  },
  metaAddToCart: {
    id: "metaAddToCart",
    label: "Meta Add to Cart",
    icon: "solar:cart-plus-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Add to cart events",
  },
  metaInitiateCheckout: {
    id: "metaInitiateCheckout",
    label: "Meta Checkouts",
    icon: "solar:cart-check-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Checkout initiations",
  },
  metaPageViews: {
    id: "metaPageViews",
    label: "Meta Page Views",
    icon: "solar:document-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Page view events",
  },
  metaViewContent: {
    id: "metaViewContent",
    label: "Meta View Content",
    icon: "solar:eye-scan-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Content views",
  },
  
  metaLinkClicks: {
    id: "metaLinkClicks",
    label: "Meta Link Clicks",
    icon: "solar:link-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Link clicks",
  },
  metaOutboundClicks: {
    id: "metaOutboundClicks",
    label: "Meta Outbound Clicks",
    icon: "solar:arrow-right-up-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Outbound clicks",
  },
  metaLandingPageViews: {
    id: "metaLandingPageViews",
    label: "Meta Landing Views",
    icon: "solar:browser-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Landing page views",
  },

  // Meta Video
  metaVideoViews: {
    id: "metaVideoViews",
    label: "Meta Video Views",
    icon: "solar:play-circle-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "Video views",
  },
  metaVideo3SecViews: {
    id: "metaVideo3SecViews",
    label: "Meta 3-Sec Views",
    icon: "solar:play-bold-duotone",
    category: "metaInsights",
    format: "number",
    description: "3-second video views",
  },
  metaCostPerThruPlay: {
    id: "metaCostPerThruPlay",
    label: "Meta Cost/ThruPlay",
    icon: "solar:dollar-circle-bold-duotone",
    category: "metaInsights",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Cost per thru-play",
  },

  // Google Analytics

  // Google Search

  // Google Shopping

  // Google Video

  // Performance Max

  // Cost Structure
  cogs: {
    id: "cogs",
    label: "COGS",
    icon: "solar:box-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Cost of goods sold",
  },
  cogsPercentageOfGross: {
    id: "cogsPercentageOfGross",
    label: "COGS % of Gross",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "COGS as percentage of gross sales",
  },
  cogsPercentageOfNet: {
    id: "cogsPercentageOfNet",
    label: "COGS % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "COGS as percentage of revenue",
  },
  shippingCosts: {
    id: "shippingCosts",
    label: "Shipping Costs",
    icon: "solar:delivery-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Total shipping costs",
  },
  shippingPercentageOfNet: {
    id: "shippingPercentageOfNet",
    label: "Shipping % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Shipping as percentage of revenue",
  },
  transactionFees: {
    id: "transactionFees",
    label: "Transaction Fees",
    icon: "solar:card-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Payment processing fees",
  },
  taxesCollected: {
    id: "taxesCollected",
    label: "Taxes Collected",
    icon: "solar:document-text-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Total taxes collected",
  },
  taxesPercentageOfRevenue: {
    id: "taxesPercentageOfRevenue",
    label: "Taxes % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Taxes as percentage of revenue",
  },
  handlingFees: {
    id: "handlingFees",
    label: "Handling Fees",
    icon: "solar:hand-money-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Handling and fulfillment fees",
  },
  handlingFeesPercentage: {
    id: "handlingFeesPercentage",
    label: "Handling % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Handling fees as percentage of revenue",
  },
  customCosts: {
    id: "customCosts",
    label: "Custom Costs",
    icon: "solar:settings-bold-duotone",
    category: "costStructure",
    format: "currency",
    prefix: "$",
    description: "Custom defined costs",
  },
  customCostsPercentage: {
    id: "customCostsPercentage",
    label: "Custom % of Revenue",
    icon: "solar:percent-bold-duotone",
    category: "costStructure",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Custom costs as percentage of revenue",
  },

  // Customer Economics
  totalCustomers: {
    id: "totalCustomers",
    label: "Total Customers",
    icon: "solar:users-group-rounded-bold-duotone",
    category: "customerEconomics",
    format: "number",
    description: "Total unique customers",
  },
  newCustomers: {
    id: "newCustomers",
    label: "New Customers",
    icon: "solar:user-plus-bold-duotone",
    category: "customerEconomics",
    format: "number",
    description: "New customers acquired",
  },
  returningCustomers: {
    id: "returningCustomers",
    label: "Returning Customers",
    icon: "solar:user-check-bold-duotone",
    category: "customerEconomics",
    format: "number",
    description: "Returning customers",
  },
  repeatCustomerRate: {
    id: "repeatCustomerRate",
    label: "Returning Customers %",
    icon: "solar:refresh-circle-bold-duotone",
    category: "customerEconomics",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Percentage of repeat customers",
  },
  customerAcquisitionCost: {
    id: "customerAcquisitionCost",
    label: "CAC",
    icon: "solar:user-plus-bold-duotone",
    category: "customerEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Customer acquisition cost",
  },
  cacPercentageOfAOV: {
    id: "cacPercentageOfAOV",
    label: "CAC % of AOV",
    icon: "solar:percent-bold-duotone",
    category: "customerEconomics",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "CAC as percentage of AOV",
  },
  cacPaybackPeriod: {
    id: "cacPaybackPeriod",
    label: "CAC Payback",
    icon: "solar:calendar-bold-duotone",
    category: "customerEconomics",
    format: "decimal",
    suffix: " days",
    decimal: 0,
    description: "Days to recover CAC",
  },
  ltvToCACRatio: {
    id: "ltvToCACRatio",
    label: "LTV:CAC Ratio",
    icon: "solar:chart-2-bold-duotone",
    category: "customerEconomics",
    format: "decimal",
    decimal: 1,
    suffix: ":1",
    description: "Lifetime value to CAC ratio",
  },
  // Unit Economics
  unitsSold: {
    id: "unitsSold",
    label: "Units Sold",
    icon: "solar:box-minimalistic-bold-duotone",
    category: "unitEconomics",
    format: "number",
    description: "Total units sold",
  },
  avgOrderProfit: {
    id: "avgOrderProfit",
    label: "Avg Order Profit",
    icon: "solar:profit-bold-duotone",
    category: "unitEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Average profit per order",
  },
  avgOrderCost: {
    id: "avgOrderCost",
    label: "Avg Order Cost",
    icon: "solar:wallet-bold-duotone",
    category: "unitEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Average cost per order",
  },
  profitPerOrder: {
    id: "profitPerOrder",
    label: "Profit/Order",
    icon: "solar:wallet-bold-duotone",
    category: "unitEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Profit per order",
  },
  profitPerUnit: {
    id: "profitPerUnit",
    label: "Profit/Unit",
    icon: "solar:money-bag-bold-duotone",
    category: "unitEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Profit per unit sold",
  },
  fulfillmentCostPerOrder: {
    id: "fulfillmentCostPerOrder",
    label: "Fulfillment/Order",
    icon: "solar:delivery-bold-duotone",
    category: "unitEconomics",
    format: "currency",
    prefix: "$",
    decimal: 2,
    description: "Fulfillment cost per order",
  },

  // Operational Efficiency
  inventoryTurnover: {
    id: "inventoryTurnover",
    label: "Inventory Turnover",
    icon: "solar:refresh-circle-bold-duotone",
    category: "operationalEfficiency",
    format: "decimal",
    decimal: 1,
    suffix: "x",
    description: "Inventory turnover rate",
  },
  returnProcessingCost: {
    id: "returnProcessingCost",
    label: "Return Cost",
    icon: "solar:rewind-back-bold-duotone",
    category: "operationalEfficiency",
    format: "currency",
    prefix: "$",
    description: "Average return processing cost",
  },
  cancelledOrderRate: {
    id: "cancelledOrderRate",
    label: "Cancellation Rate",
    icon: "solar:close-circle-bold-duotone",
    category: "operationalEfficiency",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Order cancellation rate",
  },
  returnRate: {
    id: "returnRate",
    label: "Return Rate",
    icon: "solar:restart-bold-duotone",
    category: "operationalEfficiency",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Product return rate",
  },
  refundRate: {
    id: "refundRate",
    label: "Refund Rate",
    icon: "solar:card-recive-bold-duotone",
    category: "operationalEfficiency",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Order refund rate",
  },
  // Growth Metrics
  moMRevenueGrowth: {
    id: "moMRevenueGrowth",
    label: "MoM Revenue Growth",
    icon: "solar:graph-up-new-bold-duotone",
    category: "growthMetrics",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Month-over-month revenue growth",
  },
  calendarMoMRevenueGrowth: {
    id: "calendarMoMRevenueGrowth",
    label: "MoM Growth (Calendar)",
    icon: "solar:calendar-bold-duotone",
    category: "growthMetrics",
    format: "percentage",
    suffix: "%",
    decimal: 1,
    description: "Strict calendar month-over-month revenue growth",
  },
};

// Helper function to get all metric IDs
export function getAllMetricIds(): string[] {
  return Object.keys(METRICS);
}

// Helper function to get metrics by category
export function getMetricsByCategory(categoryId: string): MetricDefinition[] {
  return Object.values(METRICS).filter(
    (metric) => metric.category === categoryId,
  );
}

// Helper function to format metric value
export function formatMetricValue(
  value: number | string,
  metric: MetricDefinition,
  currency: string = "USD",
): string {
  // Handle string values directly for any format
  if (typeof value === "string" && Number.isNaN(parseFloat(value))) {
    return value;
  }

  // Ensure value is a number for numeric formats
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  if (Number.isNaN(numValue)) {
    return "N/A";
  }

  if (metric.format === "currency") {
    const absValue = Math.abs(numValue);
    const currencySymbol = getCurrencySymbol(currency);

    if (absValue >= 1000000) {
      return `${currencySymbol}${(numValue / 1000000).toFixed(1)}M`;
    } else if (absValue >= 1000) {
      return `${currencySymbol}${(numValue / 1000).toFixed(1)}K`;
    }

    return `${currencySymbol}${numValue.toFixed(metric.decimal || 0)}`;
  }

  if (metric.format === "percentage") {
    return `${numValue.toFixed(metric.decimal || 1)}%`;
  }

  if (metric.format === "decimal") {
    const formatted = numValue.toFixed(metric.decimal || 2);

    return metric.suffix ? `${formatted}${metric.suffix}` : formatted;
  }

  // format === "number"
  return formatNumber(numValue);
}
