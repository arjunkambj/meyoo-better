/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as analytics_calculations from "../analytics/calculations.js";
import type * as analytics_customerCalculations from "../analytics/customerCalculations.js";
import type * as auth from "../auth.js";
import type * as authHelpers from "../authHelpers.js";
import type * as billing_organizationHelpers from "../billing/organizationHelpers.js";
import type * as billing_trackUsage from "../billing/trackUsage.js";
import type * as core_costs from "../core/costs.js";
import type * as core_dashboard from "../core/dashboard.js";
import type * as core_memberships from "../core/memberships.js";
import type * as core_onboarding from "../core/onboarding.js";
import type * as core_organizationLookup from "../core/organizationLookup.js";
import type * as core_organizations from "../core/organizations.js";
import type * as core_shopDomainHelper from "../core/shopDomainHelper.js";
import type * as core_teams from "../core/teams.js";
import type * as core_time from "../core/time.js";
import type * as core_usage from "../core/usage.js";
import type * as core_users from "../core/users.js";
import type * as crons from "../crons.js";
import type * as engine_analytics from "../engine/analytics.js";
import type * as engine_events from "../engine/events.js";
import type * as engine_health from "../engine/health.js";
import type * as engine_metaScheduler from "../engine/metaScheduler.js";
import type * as engine_optimizer from "../engine/optimizer.js";
import type * as engine_orchestrator from "../engine/orchestrator.js";
import type * as engine_profiler from "../engine/profiler.js";
import type * as engine_ratelimiter from "../engine/ratelimiter.js";
import type * as engine_scheduler from "../engine/scheduler.js";
import type * as engine_syncJobs from "../engine/syncJobs.js";
import type * as engine_workpool from "../engine/workpool.js";
import type * as http from "../http.js";
import type * as installations from "../installations.js";
import type * as integrations__base from "../integrations/_base.js";
import type * as integrations_meta from "../integrations/meta.js";
import type * as integrations_metaInternal from "../integrations/metaInternal.js";
import type * as integrations_metaSync from "../integrations/metaSync.js";
import type * as integrations_metaTokens from "../integrations/metaTokens.js";
import type * as integrations_shopify from "../integrations/shopify.js";
import type * as integrations_shopifySync from "../integrations/shopifySync.js";
import type * as integrations_tokenManager from "../integrations/tokenManager.js";
import type * as jobs_emailHandlers from "../jobs/emailHandlers.js";
import type * as jobs_helpers from "../jobs/helpers.js";
import type * as jobs_maintenance from "../jobs/maintenance.js";
import type * as jobs_maintenanceHandlers from "../jobs/maintenanceHandlers.js";
import type * as jobs_syncHandlers from "../jobs/syncHandlers.js";
import type * as meyoo_admin from "../meyoo/admin.js";
import type * as meyoo_tickets from "../meyoo/tickets.js";
import type * as schema_analytics from "../schema/analytics.js";
import type * as schema_core from "../schema/core.js";
import type * as schema_costs from "../schema/costs.js";
import type * as schema_meta from "../schema/meta.js";
import type * as schema_meyoo from "../schema/meyoo.js";
import type * as schema_security from "../schema/security.js";
import type * as schema_shopify from "../schema/shopify.js";
import type * as schema_sync from "../schema/sync.js";
import type * as schema_tickets from "../schema/tickets.js";
import type * as sync_http from "../sync/http.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_billing from "../utils/billing.js";
import type * as utils_crypto from "../utils/crypto.js";
import type * as utils_onboarding from "../utils/onboarding.js";
import type * as utils_shop from "../utils/shop.js";
import type * as utils_shopify from "../utils/shopify.js";
import type * as web_analytics from "../web/analytics.js";
import type * as web_customers from "../web/customers.js";
import type * as web_dashboard from "../web/dashboard.js";
import type * as web_integrationRequests from "../web/integrationRequests.js";
import type * as web_inventory from "../web/inventory.js";
import type * as web_orders from "../web/orders.js";
import type * as web_pnl from "../web/pnl.js";
import type * as web_sync from "../web/sync.js";
import type * as web_tickets from "../web/tickets.js";
import type * as webhooks_gdpr from "../webhooks/gdpr.js";
import type * as webhooks_processor from "../webhooks/processor.js";
import type * as webhooks_shopify from "../webhooks/shopify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  "analytics/calculations": typeof analytics_calculations;
  "analytics/customerCalculations": typeof analytics_customerCalculations;
  auth: typeof auth;
  authHelpers: typeof authHelpers;
  "billing/organizationHelpers": typeof billing_organizationHelpers;
  "billing/trackUsage": typeof billing_trackUsage;
  "core/costs": typeof core_costs;
  "core/dashboard": typeof core_dashboard;
  "core/memberships": typeof core_memberships;
  "core/onboarding": typeof core_onboarding;
  "core/organizationLookup": typeof core_organizationLookup;
  "core/organizations": typeof core_organizations;
  "core/shopDomainHelper": typeof core_shopDomainHelper;
  "core/teams": typeof core_teams;
  "core/time": typeof core_time;
  "core/usage": typeof core_usage;
  "core/users": typeof core_users;
  crons: typeof crons;
  "engine/analytics": typeof engine_analytics;
  "engine/events": typeof engine_events;
  "engine/health": typeof engine_health;
  "engine/metaScheduler": typeof engine_metaScheduler;
  "engine/optimizer": typeof engine_optimizer;
  "engine/orchestrator": typeof engine_orchestrator;
  "engine/profiler": typeof engine_profiler;
  "engine/ratelimiter": typeof engine_ratelimiter;
  "engine/scheduler": typeof engine_scheduler;
  "engine/syncJobs": typeof engine_syncJobs;
  "engine/workpool": typeof engine_workpool;
  http: typeof http;
  installations: typeof installations;
  "integrations/_base": typeof integrations__base;
  "integrations/meta": typeof integrations_meta;
  "integrations/metaInternal": typeof integrations_metaInternal;
  "integrations/metaSync": typeof integrations_metaSync;
  "integrations/metaTokens": typeof integrations_metaTokens;
  "integrations/shopify": typeof integrations_shopify;
  "integrations/shopifySync": typeof integrations_shopifySync;
  "integrations/tokenManager": typeof integrations_tokenManager;
  "jobs/emailHandlers": typeof jobs_emailHandlers;
  "jobs/helpers": typeof jobs_helpers;
  "jobs/maintenance": typeof jobs_maintenance;
  "jobs/maintenanceHandlers": typeof jobs_maintenanceHandlers;
  "jobs/syncHandlers": typeof jobs_syncHandlers;
  "meyoo/admin": typeof meyoo_admin;
  "meyoo/tickets": typeof meyoo_tickets;
  "schema/analytics": typeof schema_analytics;
  "schema/core": typeof schema_core;
  "schema/costs": typeof schema_costs;
  "schema/meta": typeof schema_meta;
  "schema/meyoo": typeof schema_meyoo;
  "schema/security": typeof schema_security;
  "schema/shopify": typeof schema_shopify;
  "schema/sync": typeof schema_sync;
  "schema/tickets": typeof schema_tickets;
  "sync/http": typeof sync_http;
  "utils/auth": typeof utils_auth;
  "utils/billing": typeof utils_billing;
  "utils/crypto": typeof utils_crypto;
  "utils/onboarding": typeof utils_onboarding;
  "utils/shop": typeof utils_shop;
  "utils/shopify": typeof utils_shopify;
  "web/analytics": typeof web_analytics;
  "web/customers": typeof web_customers;
  "web/dashboard": typeof web_dashboard;
  "web/integrationRequests": typeof web_integrationRequests;
  "web/inventory": typeof web_inventory;
  "web/orders": typeof web_orders;
  "web/pnl": typeof web_pnl;
  "web/sync": typeof web_sync;
  "web/tickets": typeof web_tickets;
  "webhooks/gdpr": typeof webhooks_gdpr;
  "webhooks/processor": typeof webhooks_processor;
  "webhooks/shopify": typeof webhooks_shopify;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  mainWorkpool: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        {
          before?: number;
          logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        },
        any
      >;
      enqueue: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism: number;
          };
          fnArgs: any;
          fnHandle: string;
          fnName: string;
          fnType: "action" | "mutation" | "query";
          onComplete?: { context?: any; fnHandle: string };
          retryBehavior?: {
            base: number;
            initialBackoffMs: number;
            maxAttempts: number;
          };
          runAt: number;
        },
        string
      >;
      enqueueBatch: FunctionReference<
        "mutation",
        "internal",
        {
          config: {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            maxParallelism: number;
          };
          items: Array<{
            fnArgs: any;
            fnHandle: string;
            fnName: string;
            fnType: "action" | "mutation" | "query";
            onComplete?: { context?: any; fnHandle: string };
            retryBehavior?: {
              base: number;
              initialBackoffMs: number;
              maxAttempts: number;
            };
            runAt: number;
          }>;
        },
        Array<string>
      >;
      status: FunctionReference<
        "query",
        "internal",
        { id: string },
        | { previousAttempts: number; state: "pending" }
        | { previousAttempts: number; state: "running" }
        | { state: "finished" }
      >;
      statusBatch: FunctionReference<
        "query",
        "internal",
        { ids: Array<string> },
        Array<
          | { previousAttempts: number; state: "pending" }
          | { previousAttempts: number; state: "running" }
          | { state: "finished" }
        >
      >;
    };
  };
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
  actionRetrier: {
    public: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        boolean
      >;
      cleanup: FunctionReference<
        "mutation",
        "internal",
        { runId: string },
        any
      >;
      start: FunctionReference<
        "mutation",
        "internal",
        {
          functionArgs: any;
          functionHandle: string;
          options: {
            base: number;
            initialBackoffMs: number;
            logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
            maxFailures: number;
            onComplete?: string;
            runAfter?: number;
            runAt?: number;
          };
        },
        string
      >;
      status: FunctionReference<
        "query",
        "internal",
        { runId: string },
        | { type: "inProgress" }
        | {
            result:
              | { returnValue: any; type: "success" }
              | { error: string; type: "failed" }
              | { type: "canceled" };
            type: "completed";
          }
      >;
    };
  };
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          createdAt: number;
          errorMessage?: string;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject: string;
          text?: string;
          to: string;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
