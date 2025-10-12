import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import {
  billing,
  dashboards,
  integrationRequests,
  integrationSessions,
  invites,
  invoices,
  notifications,
  onboarding,
  organizations,
  syncSessions,
  memberships,
  usage,
  users,
} from "./schema/core";
import { globalCosts, manualReturnRates, variantCosts } from "./schema/costs";
import { metaAdAccounts, metaInsights } from "./schema/meta";
import {
  dailyMetrics,
  analyticsRebuildLocks,
  inventoryProductSummaries,
  inventoryOverviewSummaries,
  customerMetricsSummaries,
  customerOverviewSummaries,
} from "./schema/metrics";
import { gdprRequests, auditLogs, webhookReceipts, apiKeys } from "./schema/security";
import { tickets, ticketResponses } from "./schema/tickets";
import {
  shopifyCustomers,
  shopifyOrderItems,
  shopifyOrders,
  shopifyProducts,
  shopifyProductVariants,
  shopifyStores,
  shopifyTransactions,
  shopifyRefunds,
  shopifyFulfillments,
  shopifyInventory,
  shopifyInventoryTotals,
  shopifySessions,
  shopifyAnalytics,
} from "./schema/shopify";
import {
  syncProfiles,
  platformRateLimits,
  schedulerState,
  integrationStatus,
} from "./schema/sync";
// Sync orchestration tables trimmed for now
// Tickets trimmed for now

export default defineSchema({
  // Core tables
  ...authTables,
  users,
  organizations,
  memberships,
  invites,
  dashboards,
  integrationSessions,
  syncSessions,
  onboarding,

  // Billing tables
  billing,
  usage,
  invoices,

  // Sync engine tables (omitted)
  syncProfiles,
  platformRateLimits,
  schedulerState,
  integrationStatus,

  // Shopify tables
  shopifyStores,
  shopifyOrders,
  shopifyOrderItems,
  shopifyProducts,
  shopifyProductVariants,
  shopifyCustomers,
  shopifyTransactions,
  shopifyRefunds,
  shopifyFulfillments,
  shopifyInventory,
  shopifyInventoryTotals,
  shopifySessions,
  shopifyAnalytics,

  // Meta tables
  metaAdAccounts,
  metaInsights,

  // Daily metrics snapshots
  dailyMetrics,
  analyticsRebuildLocks,
  inventoryProductSummaries,
  inventoryOverviewSummaries,
  customerMetricsSummaries,
  customerOverviewSummaries,

  // Operations tables
  webhookReceipts,
  auditLogs,
  gdprRequests,
  tickets,
  ticketResponses,

  // Security tables
  apiKeys,

  // Cost management tables (simplified)
  globalCosts,
  variantCosts,
  manualReturnRates,

  // Admin & Support tables (omitted)
  integrationRequests,

  // Notifications
  notifications,

});
