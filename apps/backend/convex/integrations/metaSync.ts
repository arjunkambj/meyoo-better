import { v } from "convex/values";
import { getAllInsightsFields } from "../../libs/meta/meta.config";
import { MetaAPIClient } from "../../libs/meta/MetaAPIClient";
import { createSimpleLogger } from "../../libs/logging/simple";
import { parseMoney, roundMoney } from "../../libs/utils/money";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { optionalEnv } from "../utils/env";

const logger = createSimpleLogger("MetaSync");
const LOG_META_ENABLED = optionalEnv("LOG_META") === "1";

// Type definitions
interface MetaAction {
  action_type?: string;
  value?: string | number;
}

interface MetaInsight {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  unique_clicks?: string;
  inline_link_clicks?: string;
  outbound_clicks?: Array<{ action_type?: string; value: string }>;
  video_play_actions?: Array<{ action_type?: string; value: string }>;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  website_purchase_roas?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ value: string }>;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  cost_per_thruplay?: string;
  cost_per_thru_play?: string;
}

interface MetaCampaign {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
}

/**
 * Helper function to parse Meta's actions array
 * Meta returns conversions in a nested actions array with action_type identifiers
 */
function parseMetaActions(insight: MetaInsight) {
  const metrics = {
    purchases: 0,
    purchaseValue: 0,
    addToCart: 0,
    initiateCheckout: 0,
    landingPageViews: 0,
    pageViews: 0,
    viewContent: 0,
    outboundClicks: 0,
    linkClicks: 0,
    videoViews: 0,
    video3SecViews: 0,
    videoThruPlay: 0,
    roas: 0,
  };

  // Parse actions array
  if (insight.actions && Array.isArray(insight.actions)) {
    for (const action of insight.actions) {
      const actionType = action.action_type?.toLowerCase() || "";
      const value = parseMoney(String(action.value));

      switch (actionType) {
        case "purchase":
        case "omni_purchase":
        case "offline_conversion.purchase":
          metrics.purchases += value;
          break;
        case "add_to_cart":
        case "omni_add_to_cart":
          metrics.addToCart += value;
          break;
        case "initiate_checkout":
        case "omni_initiated_checkout":
          metrics.initiateCheckout += value;
          break;
        case "landing_page_view":
          metrics.landingPageViews += value;
          break;
        case "link_click":
        case "inline_link_click":
        case "omni_link_click":
          metrics.linkClicks += value;
          break;
        case "page_view":
        case "omni_view_content":
          metrics.pageViews += value;
          break;
        case "view_content":
          metrics.viewContent += value;
          break;
        case "outbound_click":
        case "omni_outbound_click":
          metrics.outboundClicks += value;
          break;
        case "video_view":
        case "omni_video_view":
          metrics.videoViews += value;
          break;
        case "video_3_sec_views":
        case "omni_video_3_sec_views":
          metrics.video3SecViews += value;
          break;
        case "video_thru_play":
        case "omni_video_thru_play":
          metrics.videoThruPlay += value;
          break;
      }
    }
  }

  // Parse action_values array for monetary values
  if (insight.action_values && Array.isArray(insight.action_values)) {
    for (const actionValue of insight.action_values) {
      const actionType = actionValue.action_type?.toLowerCase() || "";
      const value = parseMoney(String(actionValue.value));

      switch (actionType) {
        case "purchase":
        case "omni_purchase":
        case "offline_conversion.purchase":
          metrics.purchaseValue += value;
          break;
      }
    }
  }

  // Calculate ROAS (Return on Ad Spend)
  // First check if Meta provides it directly
  if (
    insight.website_purchase_roas &&
    Array.isArray(insight.website_purchase_roas)
  ) {
    // Meta returns ROAS as an array with action_type
    const roasData = insight.website_purchase_roas.find(
      (r) => r.action_type === "omni_purchase" || r.action_type === "purchase"
    );

    if (roasData?.value) {
      metrics.roas = roundMoney(parseFloat(roasData.value));
    }
  } else if (insight.purchase_roas && Array.isArray(insight.purchase_roas)) {
    // Alternative ROAS field
    const roasData = insight.purchase_roas[0];

    if (roasData?.value) {
      metrics.roas = roundMoney(parseFloat(roasData.value));
    }
  } else if (metrics.purchaseValue > 0 && insight.spend) {
    // Calculate ROAS manually if not provided
    const spend = parseMoney(insight.spend);

    if (spend > 0) {
      metrics.roas = metrics.purchaseValue / spend;
    }
  }

  return metrics;
}

function parseCount(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildInsightRecord(
  insight: MetaInsight,
  organizationId: Id<"organizations">,
  accountId: string,
  fallbackDate?: string,
) {
  const actionMetrics = parseMetaActions(insight);
  const spend = parseMoney(insight.spend);

  const inlineLinkClicks = parseCount(insight.inline_link_clicks);
  const linkClicks = Math.round(
    actionMetrics.linkClicks > 0 ? actionMetrics.linkClicks : inlineLinkClicks,
  );

  const outboundFallback = (insight.outbound_clicks || []).reduce(
    (sum, item) => sum + parseCount(item.value),
    0,
  );
  const outboundClicks = Math.round(
    actionMetrics.outboundClicks > 0
      ? actionMetrics.outboundClicks
      : outboundFallback,
  );

  const videoFallback = (insight.video_play_actions || []).reduce(
    (acc, item) => {
      const type = item.action_type?.toLowerCase() || "";
      const value = parseCount(item.value);

      switch (type) {
        case "video_view":
          acc.videoViews += value;
          break;
        case "video_3_sec_view":
        case "video_3_sec_views":
          acc.video3SecViews += value;
          break;
        case "video_thruplay":
        case "video_thru_play":
          acc.videoThruPlay += value;
          break;
      }

      return acc;
    },
    { videoViews: 0, video3SecViews: 0, videoThruPlay: 0 },
  );

  const videoViewsFromActions = actionMetrics.videoViews || 0;
  const videoViews = Math.round(
    videoViewsFromActions > 0
      ? videoViewsFromActions
      : videoFallback.videoViews,
  );

  const video3SecViews = Math.round(
    actionMetrics.video3SecViews > 0
      ? actionMetrics.video3SecViews
      : videoFallback.video3SecViews,
  );
  const videoThruPlay = Math.round(
    actionMetrics.videoThruPlay > 0
      ? actionMetrics.videoThruPlay
      : videoFallback.videoThruPlay,
  );

  let costPerThruPlay = parseMoney(
    (insight as unknown as { cost_per_thruplay?: string }).cost_per_thruplay,
  );

  if (!costPerThruPlay) {
    costPerThruPlay = parseMoney(
      (insight as unknown as { cost_per_thru_play?: string }).cost_per_thru_play,
    );
  }

  if (!costPerThruPlay && videoThruPlay > 0 && spend > 0) {
    costPerThruPlay = roundMoney(spend / videoThruPlay);
  }

  const frequency = roundMoney(parseCount(insight.frequency));
  const ctr = roundMoney(parseCount(insight.ctr));
  const cpc = parseMoney(insight.cpc);
  const cpm = parseMoney(insight.cpm);

  const conversions = actionMetrics.purchases;
  const costPerConversion =
    conversions > 0 ? roundMoney(spend / conversions) : 0;

  return {
    organizationId,
    entityType: "account" as const,
    entityId: accountId,
    date: insight.date_start || fallbackDate || "",
    spend,
    impressions: Math.round(parseCount(insight.impressions)),
    clicks: Math.round(parseCount(insight.clicks)),
    reach: Math.round(parseCount(insight.reach)),
    frequency,
    ctr,
    cpc,
    cpm,
    uniqueClicks: Math.round(parseCount(insight.unique_clicks)),
    conversions,
    conversionValue: actionMetrics.purchaseValue,
    costPerConversion,
    roas: actionMetrics.roas,
    addToCart: actionMetrics.addToCart,
    initiateCheckout: actionMetrics.initiateCheckout,
    pageViews: actionMetrics.pageViews,
    landingPageViews: actionMetrics.landingPageViews,
    viewContent: actionMetrics.viewContent,
    linkClicks,
    outboundClicks,
    videoViews,
    video3SecViews,
    videoThruPlay,
    costPerThruPlay,
    qualityRanking: insight.quality_ranking,
    engagementRateRanking: insight.engagement_rate_ranking,
    conversionRateRanking: insight.conversion_rate_ranking,
    syncedAt: Date.now(),
  };
}

/**
 * Meta (Facebook) Sync Functions
 * Handles advertising data synchronization
 */

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
        internal.integrations.metaInternal.getActiveSessionInternal,
        {
          organizationId: args.organizationId as Id<"organizations">,
        }
      );

      if (!session) {
        throw new Error("No active Meta session found");
      }

      // Fetch a valid token via token manager before calling the API
      const accessToken = await ctx.runAction(
        internal.integrations.tokenManager.getValidAccessToken,
        {
          organizationId: args.organizationId as Id<"organizations">,
          platform: "meta",
        },
      );

      const client = new MetaAPIClient(accessToken);
      if (LOG_META_ENABLED) {
        logger.info("Initial sync start", { at: new Date().toISOString(), organizationId: args.organizationId });
      }

      // Use the specified account or get the first available account
      const accountId = args.accountId || session.primaryAccountId;

      if (!accountId) {
        throw new Error("No Meta ad account specified");
      }

      let totalRecordsProcessed = 0;
      const errors: string[] = [];

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      startDate.setDate(startDate.getDate() - daysBack);

      // Format dates for Meta API (YYYY-MM-DD)
      const formatDate = (date: Date) => date.toISOString().substring(0, 10);

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

        // Process and store each day's data separately in existing metaInsights table
        if (insights.length > 0) {
          const orgId = args.organizationId as Id<"organizations">;
          const dailyInsights = insights.map((insight: MetaInsight) =>
            buildInsightRecord(insight, orgId, accountId),
          );

          // Store in database using existing mutation
          await ctx.runMutation(
            internal.integrations.metaInternal.storeInsightsInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
              accountId: accountId,
              insights: dailyInsights,
            }
          );

          totalRecordsProcessed = dailyInsights.length;
          if (LOG_META_ENABLED) {
            logger.info("Insights stored", { at: new Date().toISOString(), organizationId: args.organizationId, count: dailyInsights.length });
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
          await ctx.runMutation(
            internal.integrations.metaInternal.storeCampaignsInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
              accountId: accountId,
              campaigns: campaigns.data.map((campaign: MetaCampaign) => ({
                ...campaign,
                accountId,
                syncedAt: Date.now(),
              })),
            }
          );
          totalRecordsProcessed += campaigns.data.length;
          if (LOG_META_ENABLED) {
            logger.info("Campaigns stored", { at: new Date().toISOString(), organizationId: args.organizationId, count: campaigns.data.length });
          }
        }

        // production: omit campaign count chatter
      } catch (error) {
        errors.push(`Insights sync failed: ${error}`);
        console.error("[Meta] Insights sync error:", error);
      }

      logger.info("Initial sync completed", { at: new Date().toISOString(), organizationId: args.organizationId, recordsProcessed: totalRecordsProcessed });

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
      logger.info("Pull daily start", { at: new Date().toISOString(), organizationId: args.organizationId });
    }
    // Resolve token
    const accessToken = await ctx.runAction(
      internal.integrations.tokenManager.getValidAccessToken,
      {
        organizationId: args.organizationId as Id<"organizations">,
        platform: "meta",
      },
    );
    const client = new MetaAPIClient(accessToken);

    const fields = Array.from(
      new Set([...getAllInsightsFields(), "date_start", "date_stop"]),
    );

    const insights = await client.getAccountInsightsPaginated(
      args.accountId,
      {
        level: "account",
        timeRange: { since: args.date, until: args.date },
        timeIncrement: "1",
      },
      fields,
    );

    if (insights.length > 0) {
      const orgId = args.organizationId as Id<"organizations">;
      const dailyInsights = insights.map((insight: MetaInsight) =>
        buildInsightRecord(insight, orgId, args.accountId, args.date),
      );

      await ctx.runMutation(
        internal.integrations.metaInternal.storeInsightsInternal,
        {
          organizationId: args.organizationId as Id<"organizations">,
          accountId: args.accountId,
          insights: dailyInsights,
        },
      );
      if (LOG_META_ENABLED) {
        logger.info("Pull daily stored", { at: new Date().toISOString(), organizationId: args.organizationId, count: dailyInsights.length });
      }
    }

    if (LOG_META_ENABLED) {
      logger.info("Pull daily done", { at: new Date().toISOString(), organizationId: args.organizationId, insights: insights.length });
    }
    return { success: true };
  },
});
