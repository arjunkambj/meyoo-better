import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import {
  channelMetrics,
  customerMetrics,
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
import { systemAnalytics, systemHealth } from "./schema/meyoo";
import { gdprRequests, auditLogs, webhookReceipts } from "./schema/security";
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
} from "./schema/shopify";
import {
  syncProfiles,
  syncHistory,
  dataFreshness,
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
  syncHistory,
  dataFreshness,
  platformRateLimits,
  schedulerState,

  // Analytics tables
  metricsDaily,
  metricsWeekly,
  metricsMonthly,
  productMetrics,
  channelMetrics,
  customerMetrics,
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

  // Meta tables
  metaAdAccounts,
  metaInsights,

  // Operations tables
  webhookReceipts,
  auditLogs,
  gdprRequests,
  tickets,
  ticketResponses,

  // Cost management tables (simplified)
  costs,
  costCategories,
  productCostComponents,

  // Admin & Support tables (omitted)
  integrationRequests,

  // Meyoo admin tables (omitted)
  // Include Meyoo/admin tables to support admin operations and logging
  systemAnalytics,
  systemHealth,

  // Notifications
  notifications,
});
