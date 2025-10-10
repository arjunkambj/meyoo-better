import { Workpool } from "@convex-dev/workpool";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

import { PRIORITY } from "./workpool";

/**
 * Event Processing Engine
 * Handles real-time events and routes them to appropriate handlers
 */

// Event types that trigger different actions
export const EVENT_TYPES = {
  // User events
  USER_LOGIN: "user:login",
  USER_LOGOUT: "user:logout",
  USER_DASHBOARD_VIEW: "user:dashboard_view",
  USER_REPORT_GENERATE: "user:report_generate",
  USER_WIDGET_INTERACT: "user:widget_interact",
  USER_DATA_EXPORT: "user:data_export",

  // Sync events
  SYNC_STARTED: "sync:started",
  SYNC_COMPLETED: "sync:completed",
  SYNC_FAILED: "sync:failed",
  SYNC_MANUAL_TRIGGERED: "sync:manual_triggered",

  // Data events
  ORDER_CREATED: "order:created",
  ORDER_CANCELLED: "order:cancelled",
  PRODUCT_UPDATED: "product:updated",
  CUSTOMER_CREATED: "customer:created",
  REFUND_CREATED: "refund:created",

  // Integration events
  INTEGRATION_CONNECTED: "integration:connected",
  INTEGRATION_DISCONNECTED: "integration:disconnected",
  INTEGRATION_RATE_LIMITED: "integration:rate_limited",

  // Analytics events
  ANALYTICS_CALCULATION_NEEDED: "analytics:calculation_needed",
  METRICS_STALE: "metrics:stale",
  CACHE_INVALIDATED: "cache:invalidated",

  // Onboarding events
  ONBOARDING_COMPLETED: "onboarding:completed",
  ONBOARDING_SYNCS_COMPLETE: "onboarding:syncs_complete",
} as const;

// Event priority mapping
const EVENT_PRIORITY_MAP: Record<string, number> = {
  // Critical events
  [EVENT_TYPES.ORDER_CREATED]: PRIORITY.CRITICAL,
  [EVENT_TYPES.ORDER_CANCELLED]: PRIORITY.CRITICAL,
  [EVENT_TYPES.REFUND_CREATED]: PRIORITY.CRITICAL,

  // High priority events
  [EVENT_TYPES.SYNC_FAILED]: PRIORITY.HIGH,
  [EVENT_TYPES.INTEGRATION_DISCONNECTED]: PRIORITY.HIGH,
  [EVENT_TYPES.USER_LOGIN]: PRIORITY.HIGH,

  // Normal priority events
  [EVENT_TYPES.PRODUCT_UPDATED]: PRIORITY.NORMAL,
  [EVENT_TYPES.CUSTOMER_CREATED]: PRIORITY.NORMAL,
  [EVENT_TYPES.USER_DASHBOARD_VIEW]: PRIORITY.NORMAL,

  // Low priority events
  [EVENT_TYPES.ANALYTICS_CALCULATION_NEEDED]: PRIORITY.LOW,
  [EVENT_TYPES.METRICS_STALE]: PRIORITY.LOW,
  [EVENT_TYPES.CACHE_INVALIDATED]: PRIORITY.LOW,
};

/**
 * Emit an event for processing
 */
export const emitEvent = internalMutation({
  args: {
    type: v.string(),
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    // Allow arbitrary metadata payloads
    metadata: v.optional(v.record(v.string(), v.any())),
    timestamp: v.optional(v.number()),
    category: v.optional(
      v.union(
        v.literal("settings"),
        v.literal("integration"),
        v.literal("user_management"),
        v.literal("data_management"),
      ),
    ),
  },
  returns: v.object({
    eventId: v.id("auditLogs"),
    processed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const timestamp = args.timestamp || Date.now();

    // Store event for audit trail
    const eventId = await ctx.db.insert("auditLogs", {
      organizationId: args.organizationId,
      userId: args.userId,
      action: args.type,
      category: args.category || "data_management",
      details: {
        metadata: args.metadata || {},
      },
      ipAddress: "", // Would come from request context
      userAgent: "", // Would come from request context
      createdAt: timestamp,
    });

    // Get event priority
    const priority = EVENT_PRIORITY_MAP[args.type] || PRIORITY.NORMAL;

    // Initialize workpool
    const workpool = new Workpool(components.mainWorkpool, {
      maxParallelism: 10,
    });

    // Route event to appropriate handler
    await routeEvent(ctx, workpool, {
      eventId,
      type: args.type,
      organizationId: args.organizationId,
      userId: args.userId,
      metadata: args.metadata,
      timestamp,
      priority,
    });

    return { eventId, processed: true };
  },
});

/**
 * Route event to appropriate handler
 */
interface EventData {
  eventId: Id<"auditLogs">;
  type: string;
  organizationId: Id<"organizations">;
  userId?: Id<"users">;
  metadata?: Record<string, unknown>;
  timestamp: number;
  priority: number;
}

async function routeEvent(
  ctx: GenericMutationCtx<DataModel>,
  workpool: Workpool,
  event: EventData,
): Promise<void> {
  const { type, organizationId, userId, metadata } = event;

  switch (type) {
    // User activity events - update sync profile
    case EVENT_TYPES.USER_LOGIN:
    case EVENT_TYPES.USER_DASHBOARD_VIEW:
    case EVENT_TYPES.USER_REPORT_GENERATE:
    case EVENT_TYPES.USER_WIDGET_INTERACT:
    case EVENT_TYPES.USER_DATA_EXPORT:
      if (userId) {
        // Map event type to profiler activity token
        const activityMap: Record<
          string,
          | "login"
          | "dashboard"
          | "report"
          | "widget"
          | "export"
          | "api"
          | "settings"
        > = {
          [EVENT_TYPES.USER_LOGIN]: "login",
          [EVENT_TYPES.USER_DASHBOARD_VIEW]: "dashboard",
          [EVENT_TYPES.USER_REPORT_GENERATE]: "report",
          [EVENT_TYPES.USER_WIDGET_INTERACT]: "widget",
          [EVENT_TYPES.USER_DATA_EXPORT]: "export",
        } as const;
        const activityType = activityMap[type] || "api";
        await workpool.enqueueMutation(
          ctx,
          internal.engine.profiler.trackActivity,
          {
            userId,
            organizationId,
            activityType,
            metadata,
          },
        );
      }
      break;

    // Order events - trigger analytics
    case EVENT_TYPES.ORDER_CREATED:
    case EVENT_TYPES.ORDER_CANCELLED:
      await workpool.enqueueAction(
        ctx,
        internal.engine.analytics.updateOrderMetrics,
        {
          organizationId,
          orderId: metadata?.orderId as string | undefined,
          eventType: type,
        },
      );
      break;

    // Product events
    case EVENT_TYPES.PRODUCT_UPDATED:
      await workpool.enqueueAction(
        ctx,
        internal.engine.analytics.updateProductMetrics,
        {
          organizationId,
          productId: metadata?.productId as string,
        },
      );
      break;

    // Customer events
    case EVENT_TYPES.CUSTOMER_CREATED:
      await workpool.enqueueAction(
        ctx,
        internal.engine.analytics.updateCustomerMetrics,
        {
          organizationId,
          customerId: metadata?.customerId as string | undefined,
        },
      );
      break;

    // Sync events
    case EVENT_TYPES.SYNC_FAILED:
      // Log failure and potentially alert
      await workpool.enqueueAction(
        ctx,
        (internal.jobs.maintenanceHandlers as any).handleSyncFailure,
        {
          organizationId,
          sessionId: metadata?.sessionId,
          error: metadata?.error,
        },
      );
      break;

    // Integration events
    case EVENT_TYPES.INTEGRATION_DISCONNECTED:
      // Mark integration as inactive and reset onboarding flags
      await workpool.enqueueAction(
        ctx,
        (internal.jobs.maintenance as any).handleDisconnection,
        {
          organizationId,
          platform: metadata?.platform,
        },
      );
      break;

    case EVENT_TYPES.INTEGRATION_RATE_LIMITED:
      // Update rate limit tracking
      await workpool.enqueueAction(
        ctx,
        (internal.engine.optimizer as any).handleRateLimit,
        {
          organizationId,
          platform: metadata?.platform,
          retryAfter: metadata?.retryAfter,
        },
      );
      break;

    // Analytics events
    case EVENT_TYPES.ANALYTICS_CALCULATION_NEEDED:
      await workpool.enqueueAction(
        ctx,
        (internal.engine.analytics as any).calculateAnalytics,
        {
          organizationId,
          dateRange: metadata?.dateRange,
        },
      );
      break;

    case EVENT_TYPES.CACHE_INVALIDATED:
      // Clear specific cache entries
      await workpool.enqueueAction(
        ctx,
        (internal.jobs.maintenanceHandlers as any).clearCache,
        {
          organizationId,
          cacheType: metadata?.cacheType,
        },
      );
      break;

    default:
      console.warn(`Unhandled event type: ${type}`);
  }
}

/**
 * Get recent events for an organization
 */
export const getRecentEvents = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    eventTypes: v.optional(v.array(v.string())),
  },

  handler: async (ctx, args) => {
    const query = ctx.db
      .query("auditLogs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc");

    const events = await query.take(args.limit || 100);

    // Filter by event types if specified
    if (args.eventTypes && args.eventTypes.length > 0) {
      return events.filter((e) => args.eventTypes?.includes(e.action));
    }

    return events;
  },
});

/**
 * Process event queue (called periodically)
 */
export const processEventQueue: any = internalMutation({
  returns: v.object({
    cleaned: v.number(),
  }),
  handler: async (ctx) => {
    // Clean up old audit logs (older than 90 days)
    const cutoffDate = Date.now() - 90 * 24 * 60 * 60 * 1000;
    // Use the by_created index to fetch a bounded batch efficiently
    const oldLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoffDate))
      .take(100);

    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }

    return { cleaned: oldLogs.length };
  },
});

/**
 * Emit batch events (for bulk operations)
 */
export const emitBatchEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        type: v.string(),
        organizationId: v.id("organizations"),
        userId: v.id("users"),
        metadata: v.optional(v.record(v.string(), v.any())),
        category: v.optional(
          v.union(
            v.literal("settings"),
            v.literal("integration"),
            v.literal("user_management"),
            v.literal("data_management"),
          ),
        ),
      }),
    ),
  },
  returns: v.object({
    processed: v.number(),
    events: v.array(
      v.object({
        eventId: v.id("auditLogs"),
        type: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const workpool = new Workpool(components.mainWorkpool, {
      maxParallelism: 10,
    });
    const results: { eventId: Id<"auditLogs">; type: string }[] = [];

    for (const event of args.events) {
      const timestamp = Date.now();

      // Store event
      const eventId = await ctx.db.insert("auditLogs", {
        organizationId: event.organizationId,
        userId: event.userId,
        action: event.type,
        category: event.category || "data_management",
        details: {
          metadata: event.metadata || {},
        },
        ipAddress: "",
        userAgent: "",
        createdAt: timestamp,
      });

      // Get priority
      const priority = EVENT_PRIORITY_MAP[event.type] || PRIORITY.NORMAL;

      // Route event
      await routeEvent(ctx, workpool, {
        eventId,
        type: event.type,
        organizationId: event.organizationId,
        userId: event.userId,
        metadata: event.metadata,
        timestamp,
        priority,
      });

      results.push({ eventId, type: event.type });
    }

    return { processed: results.length, events: results };
  },
});
