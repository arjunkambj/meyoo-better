import { v } from "convex/values";
import { getAllInsightsFields } from "../../libs/meta/meta.config";
import { MetaAPIClient } from "../../libs/meta/MetaAPIClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { msToDateString, type MsToDateOptions } from "../utils/date";
import { optionalEnv } from "../utils/env";
import type { MetaCampaign } from "./types";

const logger = createSimpleLogger("MetaSync");
const LOG_META_ENABLED = optionalEnv("LOG_META") === "1";

type AccountTimezoneSnapshot = {
  timezone?: string;
  timezoneOffsetHours?: number;
} | null;

function buildTimezoneOptions(snapshot: AccountTimezoneSnapshot): MsToDateOptions | undefined {
  if (!snapshot) return undefined;
  const { timezone, timezoneOffsetHours } = snapshot;
  const offsetMinutes =
    typeof timezoneOffsetHours === "number" && Number.isFinite(timezoneOffsetHours)
      ? Math.round(timezoneOffsetHours * 60)
      : undefined;

  if (!timezone && offsetMinutes === undefined) {
    return undefined;
  }

  return {
    timezone: timezone ?? undefined,
    offsetMinutes,
  };
}

function formatDateWithTimezone(date: Date, options?: MsToDateOptions): string {
  const formatted = msToDateString(date.getTime(), options);
  return formatted ?? date.toISOString().slice(0, 10);
}

/**
 * Initial sync - fetch 60 days of historical data
 */
export const initial = internalAction({
  args: {
    organizationId: v.string(),
    accountId: v.optional(v.string()),
    dateRange: v.optional(
      v.object({
        daysBack: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const daysBack = args.dateRange?.daysBack || 60;

    // production: avoid verbose startup logs

    try {
      // Get session to resolve primary account, but fetch a fresh/valid token via tokenManager
      const session = await ctx.runQuery(
        internal.meta.internal.getActiveSessionInternal,
        {
          organizationId: args.organizationId as Id<"organizations">,
        }
      );

      if (!session) {
        throw new Error("No active Meta session found");
      }

      // Fetch a valid token via token manager before calling the API
      const accessToken = await ctx.runAction(
        internal.meta.tokenManager.getValidAccessToken,
        {
          organizationId: args.organizationId as Id<"organizations">,
          platform: "meta",
        }
      );

      const client = new MetaAPIClient(accessToken);
      if (LOG_META_ENABLED) {
        logger.info("Initial sync start", {
          at: new Date().toISOString(),
          organizationId: args.organizationId,
        });
      }

      // Use the specified account or get the first available account
      const accountId = args.accountId || session.primaryAccountId;

      if (!accountId) {
        throw new Error("No Meta ad account specified");
      }

      const accountTimezone = await ctx.runQuery(
        internal.meta.internal.getAccountTimezoneInternal,
        {
          organizationId: args.organizationId as Id<"organizations">,
          accountId,
        }
      );
      const timezoneOptions = buildTimezoneOptions(accountTimezone);

      let totalRecordsProcessed = 0;
      const errors: string[] = [];

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      startDate.setDate(startDate.getDate() - daysBack);

      // Format dates for Meta API (YYYY-MM-DD)
      const formatDate = (date: Date) => formatDateWithTimezone(date, timezoneOptions);

      try {
        // Fetch insights with daily breakdown
        // Meta returns all days in a single response with time_increment
        // production: omit request/response chatter
        const _apiStartTime = Date.now();
        const insights = await client.getAccountInsightsPaginated(
          accountId,
          {
            level: "account",
            timeRange: {
              since: formatDate(startDate),
              until: formatDate(endDate),
            },
            timeIncrement: "1", // Daily data
          },
          getAllInsightsFields() // Get all available fields
        );

        // production: omit record count chatter here; summary is logged below

        // Store raw Meta responses so the storage layer can derive metrics
        if (insights.length > 0) {
          // Store in database using existing mutation
          await ctx.runMutation(internal.meta.internal.storeInsightsInternal, {
            organizationId: args.organizationId as Id<"organizations">,
            accountId: accountId,
            insights,
          });

          totalRecordsProcessed = insights.length;
          if (LOG_META_ENABLED) {
            logger.info("Insights stored", {
              at: new Date().toISOString(),
              organizationId: args.organizationId,
              count: insights.length,
            });
          }
        }

        // Also fetch campaigns for reference
        // production: omit campaign fetch chatter
        const campaigns = await client.getCampaigns(
          accountId,
          ["id", "name", "status", "objective", "created_time", "updated_time"],
          { limit: 500 }
        );

        if (campaigns.data && campaigns.data.length > 0) {
          await ctx.runMutation(internal.meta.internal.storeCampaignsInternal, {
            organizationId: args.organizationId as Id<"organizations">,
            accountId: accountId,
            campaigns: campaigns.data.map((campaign: MetaCampaign) => ({
              ...campaign,
              accountId,
              syncedAt: Date.now(),
            })),
          });
          totalRecordsProcessed += campaigns.data.length;
          if (LOG_META_ENABLED) {
            logger.info("Campaigns stored", {
              at: new Date().toISOString(),
              organizationId: args.organizationId,
              count: campaigns.data.length,
            });
          }
        }

        // production: omit campaign count chatter
      } catch (error) {
        errors.push(`Insights sync failed: ${error}`);
        console.error("[Meta] Insights sync error:", error);
      }

      logger.info("Initial sync completed", {
        at: new Date().toISOString(),
        organizationId: args.organizationId,
        recordsProcessed: totalRecordsProcessed,
      });

      return {
        success: errors.length === 0,
        recordsProcessed: totalRecordsProcessed,
        dataChanged: totalRecordsProcessed > 0,
      };
    } catch (error) {
      console.error(`[Meta] Initial sync failed`, error);
      throw error;
    }
  },
});

/**
 * Incremental sync - fetch recent updates
 */
export const incremental = internalAction({
  args: {
    organizationId: v.string(),
    since: v.optional(v.number()),
  },
  handler: async (_ctx, _args) => {
    try {
      // TODO: Implement incremental sync
      // 1. Get last sync timestamp
      // 2. Fetch insights for recent period
      // 3. Update campaigns/ads if changed
      // 4. Store in database

      const recordsProcessed = 0;

      return {
        success: true,
        recordsProcessed,
        dataChanged: recordsProcessed > 0,
      };
    } catch (error) {
      console.error(`[Meta] Incremental sync failed`, error);
      throw error;
    }
  },
});

/**
 * Pull a single day of account-level insights (minimal fields) and store.
 * Designed for fixed-interval batching.
 */
export const pullDaily = internalAction({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    if (LOG_META_ENABLED) {
      logger.info("Pull daily start", {
        at: new Date().toISOString(),
        organizationId: args.organizationId,
      });
    }
    // Resolve token
    const accessToken = await ctx.runAction(
      internal.meta.tokenManager.getValidAccessToken,
      {
        organizationId: args.organizationId as Id<"organizations">,
        platform: "meta",
      }
    );
    const client = new MetaAPIClient(accessToken);

    const fields = Array.from(
      new Set([...getAllInsightsFields(), "date_start", "date_stop"])
    );

    const insights = await client.getAccountInsightsPaginated(
      args.accountId,
      {
        level: "account",
        timeRange: { since: args.date, until: args.date },
        timeIncrement: "1",
      },
      fields
    );

    if (insights.length > 0) {
      await ctx.runMutation(internal.meta.internal.storeInsightsInternal, {
        organizationId: args.organizationId as Id<"organizations">,
        accountId: args.accountId,
        insights,
      });
      if (LOG_META_ENABLED) {
        logger.info("Pull daily stored", {
          at: new Date().toISOString(),
          organizationId: args.organizationId,
          count: insights.length,
        });
      }
    }

    if (LOG_META_ENABLED) {
      logger.info("Pull daily done", {
        at: new Date().toISOString(),
        organizationId: args.organizationId,
        insights: insights.length,
      });
    }
    return { success: true };
  },
});
