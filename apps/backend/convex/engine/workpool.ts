import { Workpool } from "@convex-dev/workpool";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Main workpool configuration for all async operations
 * Single source of truth for job processing
 */
export const workpool = new Workpool(components.mainWorkpool, {
  maxParallelism: 10,
});

/**
 * Priority levels for different job types
 */
export const PRIORITY = {
  CRITICAL: 10, // User-triggered actions, webhooks
  HIGH: 8, // Initial syncs, onboarding
  NORMAL: 5, // Daily syncs, regular operations
  LOW: 3, // Analytics calculations
  BACKGROUND: 1, // Cleanup, maintenance
} as const;

/**
 * Job types for the workpool
 */
export type JobType =
  | "sync:initial" // Initial 60-day sync
  | "sync:smart" // Smart adaptive sync
  | "sync:immediate" // User-triggered sync
  | "sync:scheduled" // Scheduled sync (daily/hourly)
  | "sync:manual" // Admin/API-triggered manual sync
  | "analytics:calculate" // Calculate metrics
  | "analytics:rollup" // Aggregate metrics
  | "cleanup:old_data" // Clean old data
  | "maintenance:reassign_store_users" // Post-auth store user reassign
  | "maintenance:dedupe_meta_accounts" // Cleanup duplicate Meta ad accounts
  | "email:send"; // Send notifications

// Job data types for each job type
export interface SyncJobData {
  organizationId: Id<"organizations">;
  // Back-compat: callers may pass a single platform
  platform?: "shopify" | "meta";
  // Preferred: pass one or more platforms
  platforms?: ("shopify" | "meta")[];
  syncType?: "initial" | "incremental";
  dateRange?: { daysBack: number };
  accountId?: string;
  // For immediate/manual syncs, who triggered it
  triggeredBy?: string;
}

export interface AnalyticsJobData {
  organizationId: Id<"organizations">;
  metric?: string;
  dateRange?: { startDate: string; endDate: string };
  calculateProfits?: boolean;
  hasHistoricalCosts?: boolean;
  syncType?: "initial" | "incremental";
}

export interface CleanupJobData {
  organizationId?: Id<"organizations">;
  daysToKeep?: number;
}

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  organizationId?: Id<"organizations">;
}

export interface MaintenanceReassignJobData {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
}

export type JobData =
  | SyncJobData
  | AnalyticsJobData
  | CleanupJobData
  | EmailJobData
  | MaintenanceReassignJobData;

interface JobOptions {
  runAt?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
  onComplete?: any;
  context?: Record<string, unknown>;
}

type WorkpoolContext = any;

/**
 * Create and enqueue a job in the workpool
 */
export async function createJob(
  ctx: WorkpoolContext,
  type: JobType,
  priority: number,
  data: JobData,
  options?: JobOptions,
): Promise<string> {
  // All job handlers are actions, so use enqueueAction
  let jobId: string;

  switch (type) {
    case "sync:initial":
      jobId = await workpool.enqueueAction(
        ctx as any,
        internal.jobs.syncHandlers.handleInitialSync,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 3,
            initialBackoffMs: options?.initialBackoffMs || 2000,
            base: 2,
          },
          onComplete: options?.onComplete,
          context: options?.context,
        },
      );
      break;
    case "sync:scheduled":
    case "sync:smart":
      // Normalize payload to match handler validator
      {
        const d = data as SyncJobData;
        const platforms = d.platforms ?? (d.platform ? [d.platform] : undefined);
        const normalized = (platforms ?? ["shopify", "meta"]).filter(
          (p): p is "shopify" | "meta" => p === "shopify" || p === "meta",
        );
        const payload = {
          organizationId: d.organizationId,
          platforms: normalized,
          syncType: (d.syncType ?? "incremental") as "initial" | "incremental",
        };

        jobId = await workpool.enqueueAction(
          ctx as any,
          internal.jobs.syncHandlers.handleScheduledSync,
          payload as any,
          {
            retry: {
              maxAttempts: options?.maxAttempts || 3,
              initialBackoffMs: options?.initialBackoffMs || 2000,
              base: 2,
            },
          },
        );
      }
      break;
    case "sync:immediate":
    case "sync:manual":
      // Normalize payload and include a default triggeredBy
      {
        const d = data as SyncJobData;
        const platforms = d.platforms ?? (d.platform ? [d.platform] : undefined);
        const normalized = (platforms ?? ["shopify", "meta"]).filter(
          (p): p is "shopify" | "meta" => p === "shopify" || p === "meta",
        );
        const payload = {
          organizationId: d.organizationId,
          platforms: normalized,
          syncType: (d.syncType ?? "incremental") as "initial" | "incremental",
          triggeredBy:
            d.triggeredBy || (options?.context as any)?.triggeredBy ||
            (type === "sync:manual" ? "manual" : "system"),
        };

        jobId = await workpool.enqueueAction(
          ctx as any,
          internal.jobs.syncHandlers.handleImmediateSync,
          payload as any,
          {
            retry: {
              maxAttempts: options?.maxAttempts || 3,
              initialBackoffMs: options?.initialBackoffMs || 2000,
              base: 2,
            },
          },
        );
      }
      break;
    case "analytics:calculate":
    case "analytics:rollup":
      jobId = await workpool.enqueueAction(
        ctx as any,
        (internal.engine.analytics as any).calculateAnalytics,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 3,
            initialBackoffMs: options?.initialBackoffMs || 2000,
            base: 2,
          },
        },
      );
      break;
    case "cleanup:old_data":
      jobId = await workpool.enqueueAction(
        ctx as any,
        internal.jobs.maintenanceHandlers.handleDataCleanup,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 2,
            initialBackoffMs: options?.initialBackoffMs || 5000,
            base: 2,
          },
        },
      );
      break;
    case "maintenance:reassign_store_users":
      jobId = await workpool.enqueueAction(
        ctx as any,
        internal.jobs.maintenanceHandlers.handleReassignStoreUsers,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 2,
            initialBackoffMs: options?.initialBackoffMs || 2000,
            base: 2,
          },
        },
      );
      break;
    case "maintenance:dedupe_meta_accounts":
      jobId = await workpool.enqueueAction(
        ctx as any,
        (internal.jobs.maintenanceHandlers as any).dedupeMetaAdAccounts,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 2,
            initialBackoffMs: options?.initialBackoffMs || 2000,
            base: 2,
          },
        },
      );
      break;
    case "email:send":
      jobId = await workpool.enqueueAction(
        ctx as any,
        internal.jobs.emailHandlers.handleEmailSend,
        data as any,
        {
          retry: {
            maxAttempts: options?.maxAttempts || 3,
            initialBackoffMs: options?.initialBackoffMs || 1000,
            base: 2,
          },
        },
      );
      break;
    default:
      throw new Error(`Unknown job type: ${type}`);
  }

  // production: avoid noisy per-job enqueue logs

  return jobId;
}

interface JobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  lastError: string | null;
}

/**
 * Get job status and metadata
 */
export async function getJobStatus(
  _ctx: WorkpoolContext,
  jobId: string,
): Promise<JobStatus> {
  // Implementation will depend on workpool internals
  // This is a placeholder for job monitoring
  return {
    id: jobId,
    status: "pending",
    attempts: 0,
    lastError: null,
  };
}
