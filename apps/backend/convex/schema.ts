import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import {
  customerMetrics,
  customerMetricsQueue,
  customerMetricsQueueState,
  metricsDaily,
  metricsMonthly,
  metricsWeekly,
  productMetrics,
  realtimeMetrics,
} from "./schema/analytics";
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
import { costCategories, costs, productCostComponents } from "./schema/costs";
import { metaAdAccounts, metaInsights } from "./schema/meta";
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
  shopifySessions,
  shopifyAnalytics,
} from "./schema/shopify";
import {
  syncProfiles,
  platformRateLimits,
  schedulerState,
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

  // Analytics tables
  metricsDaily,
  metricsWeekly,
  metricsMonthly,
  productMetrics,
  customerMetrics,
  customerMetricsQueue,
  customerMetricsQueueState,
  realtimeMetrics,

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
  shopifySessions,
  shopifyAnalytics,

  // Meta tables
  metaAdAccounts,
  metaInsights,

  // Operations tables
  webhookReceipts,
  auditLogs,
  gdprRequests,
  tickets,
  ticketResponses,

  // Security tables
  apiKeys,

  // Cost management tables (simplified)
  costs,
  costCategories,
  productCostComponents,

  // Admin & Support tables (omitted)
  integrationRequests,

  // Notifications
  notifications,

});
