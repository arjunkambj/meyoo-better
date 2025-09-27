import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { createJob, PRIORITY, type SyncJobData } from "../engine/workpool";
import type { MetaInsight } from "../../libs/meta/MetaAPIClient";
import { api, internal } from "../_generated/api";
import { META_CONFIG as BACKEND_META_CONFIG } from "../../libs/meta/meta.config";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import {
  createIntegration,
  type Integration,
  IntegrationError,
  type SyncResult,
  SyncUtils,
} from "./_base";

// Type for Meta Ad Account from API
interface MetaAdAccount {
  id: string;
  name?: string;
  business_id?: string;
  business_name?: string;
  business?: {
    id: string;
    name?: string;
  };
  timezone_name?: string;
  timezone_offset_hours_utc?: number;
  account_status?: number;
  disable_reason?: number;
  spend_cap?: number | string;
  amount_spent?: number | string;
  currency?: string;
  accountStatus?: number;
  spendCap?: number | string;
  amountSpent?: number | string;
  timezone?: string;
}

/**
 * Meta (Facebook) Integration
 * Handles Facebook and Instagram advertising data
 */
export const meta: Integration = createIntegration({
  name: "meta",
  displayName: "Meta",
  version: "1.0.0",
  icon: "mdi:facebook",

  /**
   * Sync operations
   */
  sync: {
    /**
     * Initial sync - fetch 60 days of historical data
     */
    initial: async (ctx, args) => {
      const dateRange = args.dateRange || SyncUtils.getInitialDateRange(60);

      try {
        const startedAt = Date.now();
        // Get Meta integration session
        const session = await ctx.runQuery(
          internal.integrations.meta.getActiveSessionInternal,
          { organizationId: args.organizationId as Id<"organizations"> }
        );

        if (!session) {
          throw new IntegrationError(
            "No active Meta integration found",
            "SESSION_NOT_FOUND",
            "meta"
          );
        }

        // Initialize Meta client
        const client = await initializeMetaClient(session);

        let recordsProcessed = 0;
        const errors: string[] = [];

        // Get all ad accounts
        const adAccounts = await fetchAdAccounts(client);

        const _storeResult: null = await ctx.runMutation(
          internal.integrations.meta.storeAdAccountsInternal,
          {
            organizationId: args.organizationId as Id<"organizations">,
            accounts: adAccounts,
          }
        );
        
        // Only sync primary account for insights (fallback to first if none marked)
        const storedAccounts = await ctx.runQuery(
          internal.integrations.meta.getStoredAdAccountsInternal,
          { organizationId: args.organizationId as Id<"organizations"> }
        );
        const accountsToSync = storedAccounts.slice(0, 1);

        recordsProcessed += accountsToSync.length;

        // For primary account only, fetch insights
        for (const account of accountsToSync) {
          try {
            // Fetch campaign insights
            const campaigns = await fetchCampaigns(client, account.accountId, {
              startDate:
                dateRange.startDate || new Date().toISOString().substring(0, 10),
              endDate:
                dateRange.endDate || new Date().toISOString().substring(0, 10),
            });

            await ctx.runMutation(
              internal.integrations.meta.storeCampaignsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                campaigns,
              }
            );
            recordsProcessed += campaigns.length;

            // Fetch daily insights
            const insights = await fetchInsights(client, account.accountId, {
              startDate:
                dateRange.startDate || new Date().toISOString().substring(0, 10),
              endDate:
                dateRange.endDate || new Date().toISOString().substring(0, 10),
            });

            await ctx.runMutation(
              internal.integrations.meta.storeInsightsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                insights,
              }
            );
            recordsProcessed += insights.length;
          } catch (error) {
            errors.push(
              `Account ${account.accountName} sync failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }

        const result = SyncUtils.formatResult(
          errors.length === 0,
          recordsProcessed,
          recordsProcessed > 0,
          errors
        );
        console.log(`[Meta] sync.initial`, {
          org: String(args.organizationId),
          durationMs: Date.now() - startedAt,
          recordsProcessed,
          errors: errors.length,
        });
        return result;
      } catch (error) {
        return SyncUtils.formatResult(false, 0, false, [
          error instanceof Error ? error.message : String(error),
        ]);
      }
    },

    /**
     * Incremental sync - fetch recent updates
     */
    incremental: async (ctx, args) => {
      try {
        const startedAt = Date.now();
        const session = await ctx.runQuery(
          internal.integrations.meta.getActiveSessionInternal,
          {
            organizationId: args.organizationId as Id<"organizations">,
          }
        );

        if (!session) {
          throw new IntegrationError(
            "No active Meta integration found",
            "SESSION_NOT_FOUND",
            "meta"
          );
        }

        const client = await initializeMetaClient(session);
        const lastSync =
          args.since ||
          (await ctx.runQuery(
            internal.integrations.meta.getLastSyncTimeInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
            }
          ));

        let recordsProcessed = 0;

        // Get active ad accounts
        const adAccounts = await ctx.runQuery(
          internal.integrations.meta.getStoredAdAccountsInternal,
          { organizationId: args.organizationId as Id<"organizations"> }
        );

        for (const account of adAccounts) {
          // Fetch recent insights
          const insights = await fetchInsightsSince(
            client,
            account.accountId,
            lastSync
          );

          if (insights.length > 0) {
            await ctx.runMutation(
              internal.integrations.meta.storeInsightsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                insights,
              }
            );
            recordsProcessed += insights.length;
          }
        }

        const result = SyncUtils.formatResult(
          true,
          recordsProcessed,
          recordsProcessed > 0
        );
        console.log(`[Meta] sync.incremental`, {
          org: String(args.organizationId),
          durationMs: Date.now() - startedAt,
          recordsProcessed,
        });
        return result;
      } catch (error) {
        return SyncUtils.formatResult(false, 0, false, [
          error instanceof Error ? error.message : String(error),
        ]);
      }
    },

    /**
     * Daily sync - scheduled daily sync for all accounts
     */
    daily: async (ctx, args): Promise<SyncResult> => {
      // Get yesterday's data
      const yesterday = new Date();

      yesterday.setDate(yesterday.getDate() - 1);
      const dateRange = {
        startDate: yesterday.toISOString().split("T")[0],
        endDate: yesterday.toISOString().split("T")[0],
      };

      return meta.sync.incremental(ctx, {
        ...args,
        since: dateRange.startDate,
      });
    },

    /**
     * Validate Meta connection
     */
    validate: async (ctx, args) => {
      try {
        const session = await ctx.runQuery(
          internal.integrations.meta.getActiveSessionInternal,
          { organizationId: args.organizationId as Id<"organizations"> }
        );

        if (!session) return false;

        const client = await initializeMetaClient(session);
        // Try to fetch user info to validate token
        const user = await client.getMe();

        return !!user;
      } catch {
        return false;
      }
    },
  },

  /**
   * Data queries
   */
  queries: {
    /**
     * Get Meta ad accounts
     */
    getAdAccounts: query({
      args: {},
      returns: v.array(v.any()),
      handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);

        if (!userId) return [];
        const user = await ctx.db.get(userId);

        if (!user?.organizationId) return [];

        const accounts = await ctx.db
          .query("metaAdAccounts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", user.organizationId as Id<"organizations">)
          )
          .collect();

        return accounts;
      },
    }),

    /**
     * Get Meta insights
     */
    getInsights: query({
      args: {
        accountId: v.optional(v.id("metaAdAccounts")),
        dateRange: v.optional(
          v.object({
            startDate: v.string(),
            endDate: v.string(),
          })
        ),
      },
      handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);

        if (!userId) return [];
        const user = await ctx.db.get(userId);

        if (!user?.organizationId) return [];

        // Get insights using indexes where possible
        let insights: Doc<"metaInsights">[];

        if (args.accountId) {
          const account = await ctx.db.get(args.accountId);

          if (!account) return [];

          // Use entity index for specific account with date filtering
          if (args.dateRange) {
            const dr = args.dateRange!;
            insights = (await ctx.db
              .query("metaInsights")
              .withIndex("by_entity_date", (q) =>
                q
                  .eq("entityType", "account")
                  .eq("entityId", account.accountId)
                  .gte("date", dr.startDate)
                  .lte("date", dr.endDate)
              )
              .take(1000)) as Doc<"metaInsights">[];
          } else {
            insights = (await ctx.db
              .query("metaInsights")
              .withIndex("by_entity_date", (q) =>
                q.eq("entityType", "account").eq("entityId", account.accountId)
              )
              .take(1000)) as Doc<"metaInsights">[];
          }
        } else {
          // Get all insights for organization with date filtering
          if (args.dateRange) {
            const dr = args.dateRange!;
            // Use the by_org_date index for efficient date filtering
            insights = (await ctx.db
              .query("metaInsights")
              .withIndex("by_org_date", (q) =>
                q
                  .eq(
                    "organizationId",
                    user.organizationId as Id<"organizations">
                  )
                  .gte("date", dr.startDate)
                  .lte("date", dr.endDate)
              )
              .take(1000)) as Doc<"metaInsights">[];
          } else {
            insights = (await ctx.db
              .query("metaInsights")
              .withIndex("by_organization", (q) =>
                q.eq(
                  "organizationId",
                  user.organizationId as Id<"organizations">
                )
              )
              .take(1000)) as Doc<"metaInsights">[];
          }
        }

        return insights;
      },
    }),

    /**
     * Get campaigns
     */
    getCampaigns: query({
      args: {
        accountId: v.optional(v.id("metaAdAccounts")),
      },
      returns: v.array(v.any()),
      handler: async (ctx, _args) => {
        const userId = await getAuthUserId(ctx);

        if (!userId) return [];
        const user = await ctx.db.get(userId);

        if (!user?.organizationId) return [];

        // For now, return empty array - implement when campaign table is added
        return [];
      },
    }),
  },

  /**
   * OAuth configuration
   */
  oauth: {
    authorizationUrl: `https://www.facebook.com/${BACKEND_META_CONFIG.API_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${BACKEND_META_CONFIG.API_VERSION}/oauth/access_token`,
    // Minimal scopes for reading ads and business assets
    scopes: ["ads_read", "business_management"],
  },

  /**
   * Rate limiting
   */
  rateLimit: {
    requests: 200,
    window: 3600000, // 200 requests per hour
    concurrent: 5,
  },

  /**
   * Required environment variables
   */
  requiredEnvVars: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],

  /**
   * API cost
   */
  apiCost: 0.0001, // Estimated cost per API call
});

// Helper functions

async function initializeMetaClient(
  _session: Doc<"integrationSessions">
): Promise<{
  getMe: () => Promise<{ id: string; name: string }>;
  getAdAccounts: () => Promise<MetaAdAccount[]>;
  getCampaigns: (_accountId: string) => Promise<unknown[]>;
  getInsights: (
    _accountId: string,
    _params: Record<string, unknown>
  ) => Promise<MetaInsight[]>;
}> {
  // This would initialize the actual Meta Graph API client
  // For now, returning a mock client
  return {
    getMe: async () => ({ id: "123", name: "User" }),
    getAdAccounts: async () => [],
    getCampaigns: async (_accountId: string) => [],
    getInsights: async (
      _accountId: string,
      _params: Record<string, unknown>
    ) => [],
  };
}

async function fetchAdAccounts(
  _client: unknown
): Promise<Array<{ accountId: string; accountName: string }>> {
  // Implement actual Meta API call
  // GET /me/adaccounts
  return [];
}

async function fetchCampaigns(
  _client: unknown,
  _accountId: string,
  _dateRange: { startDate: string; endDate: string }
): Promise<unknown[]> {
  // Implement actual Meta API call
  // GET /{ad-account-id}/campaigns
  return [];
}

async function fetchInsights(
  _client: unknown,
  _accountId: string,
  dateRange: { startDate: string; endDate: string }
): Promise<MetaInsight[]> {
  // Implement actual Meta API call
  // GET /{ad-account-id}/insights
  const _params = {
    time_range: {
      since: dateRange.startDate,
      until: dateRange.endDate,
    },
    level: "account",
    fields: [
      "spend",
      "impressions",
      "clicks",
      "cpm",
      "cpc",
      "ctr",
      "conversions",
      "conversion_rate",
      "cost_per_conversion",
      "reach",
      "frequency",
    ].join(","),
  };

  return [];
}

async function fetchInsightsSince(
  _client: unknown,
  _accountId: string,
  _since: string
): Promise<MetaInsight[]> {
  // Implement actual Meta API call with since date
  return [];
}

async function storeAdAccounts(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
  accounts: unknown[],
): Promise<void> {
  const metaAccounts = accounts as MetaAdAccount[];

  for (const account of metaAccounts) {
    // Scope lookup by organization + account to avoid cross-org conflicts
    // Read only a single candidate to minimize the read set and reduce conflicts.
    const existing = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_account_org", (q) =>
        q.eq("accountId", account.id).eq("organizationId", organizationId),
      )
      .first();

    const toNumber = (val?: string | number): number | undefined =>
      val === undefined
        ? undefined
        : typeof val === "number"
          ? val
          : parseFloat(val) || 0;

    const now = Date.now();

    const accountData = {
      accountName: account.name || "Unnamed Account",
      businessId: account.business_id || account.business?.id,
      metaBusinessName: account.business_name || account.business?.name,
      timezone: account.timezone_name || account.timezone,
      timezoneOffsetHours: account.timezone_offset_hours_utc,
      accountStatus: account.account_status || account.accountStatus,
      disableReason: account.disable_reason
        ? String(account.disable_reason)
        : undefined,
      spendCap: toNumber(account.spend_cap ?? account.spendCap),
      amountSpent: toNumber(account.amount_spent ?? account.amountSpent),
      status: "active" as const,
      isActive: true,
      updatedAt: now,
    };

    if (existing) {
      // Upsert: update the one matching document only
      await ctx.db.patch(existing._id, {
        ...accountData,
        // Preserve the last successful sync timestamp so onboarding can trigger jobs when needed.
        syncedAt: existing.syncedAt ?? 0,
      });
    } else {
      // Find the first integration session to use as connectionId
      const session = await ctx.db
        .query("integrationSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("platform", "meta")
            .eq("isActive", true)
        )
        .first();

      if (session) {
        await ctx.db.insert("metaAdAccounts", {
          organizationId,
          connectionId: session._id,
          accountId: account.id,
          ...accountData,
          // 0 represents "never synced"; initial sync will update this timestamp.
          syncedAt: 0,
          isPrimary: false,
        });
      }
    }
  }
}

async function storeCampaigns(
  _ctx: GenericMutationCtx<DataModel>,
  _organizationId: Id<"organizations">,
  _accountId: string,
  campaigns: unknown[]
): Promise<void> {
  // Store campaigns - implement when campaign table is added
  for (const _campaign of campaigns) {
    // Store campaign data
  }
}

// Helper function to safely parse numeric values from Meta API
function parseMetricValue(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Helper to extract action value by type
function getActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionType: string
): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseMetricValue(action.value) : 0;
}

async function storeInsights(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
  accountId: string,
  insights: unknown[]
): Promise<void> {
  const metaInsights = insights as MetaInsight[];

  for (const insight of metaInsights) {
    const existing = await ctx.db
      .query("metaInsights")
      .withIndex("by_entity_date", (q) =>
        q
          .eq("entityType", "account")
          .eq("entityId", accountId)
          .eq("date", insight.date_start || "")
      )
      .first();

    // Parse insight data with proper type handling
    const insightData = {
      spend: parseMetricValue(insight.spend),
      reach: insight.reach ? parseMetricValue(insight.reach) : undefined,
      impressions: parseMetricValue(insight.impressions),
      frequency: insight.frequency
        ? parseMetricValue(insight.frequency)
        : undefined,
      clicks: parseMetricValue(insight.clicks),
      uniqueClicks: getActionValue(insight.actions, "unique_clicks"),
      ctr: insight.ctr ? parseMetricValue(insight.ctr) : undefined,
      cpc: insight.cpc ? parseMetricValue(insight.cpc) : undefined,
      cpm: insight.cpm ? parseMetricValue(insight.cpm) : undefined,
      conversions: getActionValue(insight.actions, "purchase"),
      conversionValue: getActionValue(insight.action_values, "purchase"),
      costPerConversion: getActionValue(insight.actions, "cost_per_purchase"),
      roas: insight.purchase_roas
        ? getActionValue(insight.purchase_roas, "purchase")
        : undefined,
      addToCart: getActionValue(insight.actions, "add_to_cart"),
      initiateCheckout: getActionValue(insight.actions, "initiate_checkout"),
      pageViews: getActionValue(insight.actions, "page_view"),
      qualityRanking: insight.quality_ranking as string | undefined,
      engagementRateRanking: insight.engagement_rate_ranking as
        | string
        | undefined,
      conversionRateRanking: insight.conversion_rate_ranking as
        | string
        | undefined,
      viewContent: getActionValue(insight.actions, "view_content"),
      
      videoViews: getActionValue(insight.actions, "video_view"),
      video3SecViews: getActionValue(insight.actions, "video_3_sec_views"),
      videoThruPlay: getActionValue(insight.actions, "video_thru_play"),
      costPerThruPlay: getActionValue(insight.actions, "cost_per_thru_play"),
      linkClicks: getActionValue(insight.actions, "link_click"),
      outboundClicks: getActionValue(insight.actions, "outbound_click"),
      landingPageViews: getActionValue(insight.actions, "landing_page_view"),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, insightData);
    } else {
      await ctx.db.insert("metaInsights", {
        organizationId,
        entityType: "account" as const,
        entityId: accountId,
        date: insight.date_start || "",
        ...insightData,
      });
    }
  }
}

/**
 * OAuth connection handler
 */
/**
 * Internal queries for database reads
 */
export const getActiveSessionInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },

  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", "meta")
          .eq("isActive", true)
      )
      .first();
  },
});

export const getLastSyncTimeInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const lastSyncSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q.eq("organizationId", args.organizationId).eq("platform", "meta"),
      )
      .order("desc")
      .first();

    const timestamp = lastSyncSession?.completedAt ?? lastSyncSession?.startedAt;

    return timestamp
      ? new Date(timestamp).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  },
});

export const getStoredAdAccountsInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("metaAdAccounts"),
      organizationId: v.id("organizations"),
      accountId: v.string(),
      accountName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    // Prefer primary account; fall back to first account if none marked
    const primary = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization_and_isPrimary", (q) =>
        q.eq("organizationId", args.organizationId).eq("isPrimary", true)
      )
      .first();

    if (primary) {
      return [
        {
          _id: primary._id as Id<"metaAdAccounts">,
          organizationId: primary.organizationId as Id<"organizations">,
          accountId: primary.accountId,
          accountName: primary.accountName,
        },
      ];
    }

    const any = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    return any
      ? [
          {
            _id: any._id as Id<"metaAdAccounts">,
            organizationId: any.organizationId as Id<"organizations">,
            accountId: any.accountId,
            accountName: any.accountName,
          },
        ]
      : [];
  },
});

/**
 * Internal mutations for database operations
 */
export const storeAdAccountsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accounts: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await storeAdAccounts(ctx, args.organizationId, args.accounts);

    return null;
  },
});

export const storeCampaignsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
    campaigns: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await storeCampaigns(
      ctx,
      args.organizationId,
      args.accountId,
      args.campaigns
    );

    return null;
  },
});

export const storeInsightsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.string(),
    insights: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await storeInsights(
      ctx,
      args.organizationId,
      args.accountId,
      args.insights
    );

    return null;
  },
});

export const connectMeta = mutation({
  args: {
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresIn: v.optional(v.number()),
    scope: v.optional(v.string()),
    userId: v.string(),
    userName: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    await ctx.db.insert("integrationSessions", {
      organizationId: user.organizationId,
      userId: user._id,
      platform: "meta",
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresIn
        ? Date.now() + args.expiresIn * 1000
        : undefined,
      scope: args.scope,
      accountId: args.userId,
      accountName: args.userName,
      isActive: true,
      lastUsedAt: Date.now(),
      metadata: {
        additionalScopes: args.scope ? args.scope.split(" ") : [],
        tokenKind: "short",
        lastRefreshedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    // Schedule immediate background exchange to long‑lived token
    try {
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.tokenManager.getValidAccessToken,
        {
          organizationId: user.organizationId as Id<"organizations">,
          platform: "meta",
        },
      );
    } catch (e) {
      console.warn("[Meta] Failed to schedule token exchange action:", e);
    }

    
    // Mark user as connected to Meta in onboarding table
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q
          .eq("userId", user._id)
          .eq("organizationId", user.organizationId as Id<"organizations">)
      )
      .first();

    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        hasMetaConnection: true,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.patch(user._id, {
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============ ADDITIONAL QUERIES ============

/**
 * Get Meta ad accounts for current user
 */
export const getAdAccounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

  // Get ad accounts from database
  const accounts = await ctx.db
    .query("metaAdAccounts")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", user.organizationId as Id<"organizations">)
    )
    .collect();

    return accounts.map((account) => ({
      id: account._id,
      accountId: account.accountId,
      accountName: account.accountName,
      isActive: account.isActive,
      isPrimary: account.isPrimary,
      lastSyncAt: account.syncedAt,
    }));
  },
});

/**
 * Get single Meta ad account by ID
 */
export const getAdAccount = query({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    // Find the specific ad account
    const account = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();

    if (!account) return null;

    return {
      id: account._id,
      accountId: account.accountId,
      accountName: account.accountName,
      isActive: account.isActive,
      isPrimary: account.isPrimary,
      lastSyncAt: account.syncedAt,
    };
  },
});

/**
 * Get Meta insights
 */
export const getInsights = query({
  args: {
    accountId: v.optional(v.string()),
    dateRange: v.optional(
      v.object({
        start: v.string(),
        end: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    // Get insights from database based on filters
    const insightsQuery = ctx.db
      .query("metaInsights")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">)
      );

  const insights = await insightsQuery.collect();

    // Filter by accountId and dateRange in memory if provided
    let filteredInsights = insights;

    if (args.accountId) {
      filteredInsights = filteredInsights.filter(
        (i) => i.entityId === args.accountId
      );
    }

    if (args.dateRange?.start && args.dateRange.end) {
      const { start, end } = args.dateRange;
      filteredInsights = filteredInsights.filter(
        (i) => i.date >= start && i.date <= end
      );
    }

  return filteredInsights;
  },
});

/**
 * Get Meta campaigns
 */
export const getCampaigns = query({
  args: {
    accountId: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    // TODO: metaCampaigns table doesn't exist in schema yet
    // Return empty array until table is created
    return [];
  },
});

/**
 * Get Meta connection summary (public)
 */
export const getConnection = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    accountId: v.optional(v.string()),
    accountName: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    tokenKind: v.optional(v.union(v.literal("short"), v.literal("long"))),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { connected: false };

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) return { connected: false };

    const session = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("platform", "meta")
          .eq("isActive", true),
      )
      .first();

    if (!session) return { connected: false };

    return {
      connected: true,
      accountId: session.accountId,
      accountName: session.accountName,
      expiresAt: session.expiresAt,
      tokenKind: session.metadata?.tokenKind,
    };
  },
});

// ============ ADDITIONAL MUTATIONS ============

/**
 * Set primary Meta ad account
 */
export const setPrimaryAdAccount = mutation({
  args: {
    accountId: v.string(),
  },
  returns: v.object({ success: v.boolean(), jobScheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Find all accounts for this organization in one query
    const accounts = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .collect();

    // Find the target account and current primary
    const target = accounts.find(acc => acc.accountId === args.accountId);
    if (!target) return { success: false, jobScheduled: false };

    const currentPrimary = accounts.find(acc => acc.isPrimary);

    // Patch only the necessary docs
    if (!target.isPrimary) {
      await ctx.db.patch(target._id, { isPrimary: true, updatedAt: Date.now() });
    }
    if (currentPrimary && currentPrimary._id !== target._id) {
      await ctx.db.patch(currentPrimary._id, {
        isPrimary: false,
        updatedAt: Date.now(),
      });
    }

    // Update onboarding step from 4 (accounts) to 5 (products)
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    if (onboarding && onboarding.onboardingStep === 4) {
      await ctx.db.patch(onboarding._id, {
        onboardingStep: 5, // Move to products step
        updatedAt: Date.now(),
      });
    }

    // Schedule Meta data fetch for the primary account (only if not already synced)
    let jobScheduled = false;
    if (user.organizationId) {
      // Check if we've already synced this account recently
      const recentSync = await ctx.db
        .query("metaAdAccounts")
        .withIndex("by_account_org", (q) =>
          q
            .eq("accountId", args.accountId)
            .eq("organizationId", user.organizationId as Id<"organizations">),
        )
        .first();

      // Only schedule if not synced in the last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const shouldSync = !recentSync?.syncedAt || recentSync.syncedAt < oneHourAgo;

      if (shouldSync) {
        try {
          // Schedule the initial sync for Meta
          await createJob(
            ctx as any,
            "sync:initial",
            PRIORITY.HIGH,
            {
              organizationId: user.organizationId as Id<"organizations">,
              platform: "meta",
              syncType: "initial",
              dateRange: { daysBack: 60 },
              accountId: args.accountId,
            } as SyncJobData,
          );
          jobScheduled = true;
        } catch (error) {
          console.warn("[META] Failed to schedule initial fetch job:", error);
        }
      }
    }

    return { success: true, jobScheduled };
  },
});

/**
 * Store Meta ad accounts from OAuth callback (public)
 */
export const storeAdAccountsFromCallback = mutation({
  args: {
    accounts: v.array(v.any()),
  },
  returns: v.object({ success: v.boolean(), stored: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Normalize input to match storeAdAccounts expected fields
    const normalized = args.accounts.map((acc) => {
      const account = acc as MetaAdAccount;
      return {
        id: account.id,
        name: account.name,
        currency: account.currency,
        timezone_name: account.timezone ?? account.timezone_name,
        account_status: account.accountStatus ?? account.account_status,
        spend_cap: account.spendCap ?? account.spend_cap,
        amount_spent: account.amountSpent ?? account.amount_spent,
        business_id: account.business_id ?? account.business?.id,
        business_name: account.business_name ?? account.business?.name,
        timezone_offset_hours_utc: account.timezone_offset_hours_utc,
        disable_reason: account.disable_reason,
      };
    });

    await storeAdAccounts(ctx, user.organizationId, normalized);

    // Best-effort background dedupe to clean up any accidental duplicates
    try {
      await createJob(
        ctx as any,
        "maintenance:dedupe_meta_accounts",
        PRIORITY.BACKGROUND,
        {
          organizationId: user.organizationId as Id<"organizations">,
        } as any,
      );
    } catch {
      /* no-op */
    }

    return { success: true, stored: normalized.length };
  },
});

/**
 * Get integration session for organization (internal)
 */
export const getIntegrationSession = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId as Id<"organizations">)
          .eq("platform", "meta")
          .eq("isActive", true)
      )
      .first();

    return session;
  },
});

/**
 * Fetch Meta ad accounts action
 * Used to fetch accounts after OAuth connection
 */
export const fetchMetaAccountsAction = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accounts: v.array(
      v.object({
        id: v.string(),
        name: v.optional(v.string()),
        currency: v.optional(v.string()),
        timezone: v.optional(v.string()),
        accountStatus: v.optional(v.number()),
        spendCap: v.optional(v.number()),
        amountSpent: v.optional(v.number()),
        business_id: v.optional(v.string()),
        business_name: v.optional(v.string()),
      })
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);

      if (!userId) {
        return { success: false, accounts: [], error: "Not authenticated" };
      }

      // Get user and organization
      const user = await ctx.runQuery(api.core.users.getCurrentUser);

      if (!user?.organizationId) {
        return {
          success: false,
          accounts: [],
          error: "User or organization not found",
        };
      }

      // Get Meta integration session
      const session = await ctx.runQuery(
        internal.integrations.meta.getIntegrationSession,
        {
          organizationId: user.organizationId,
        }
      );

      if (!session) {
        return {
          success: false,
          accounts: [],
          error: "No Meta integration found",
        };
      }

      // Always obtain a fresh/valid token via the token manager
      const accessToken = await ctx.runAction(
        internal.integrations.tokenManager.getValidAccessToken,
        {
          organizationId: user.organizationId as Id<"organizations">,
          platform: "meta",
        },
      );

      // OAuth fetch is infrequent; keep only one summary log after storing

      // Fetch ad accounts and businesses in parallel (versioned)
      const VERSION = BACKEND_META_CONFIG.API_VERSION;
      const [adAccountsRes, businessesRes] = await Promise.all([
        fetch(
          `https://graph.facebook.com/${VERSION}/me/adaccounts?fields=id,name,currency,timezone_name,account_status,spend_cap,amount_spent,business&limit=100&access_token=${accessToken}`
        ),
        fetch(
          `https://graph.facebook.com/${VERSION}/me/businesses?access_token=${accessToken}`
        ),
      ]);

      const [adAccountsData, businessesData]: [
        { data?: Array<Record<string, unknown>> },
        { data?: Array<Record<string, unknown>> },
      ] = await Promise.all([adAccountsRes.json(), businessesRes.json()]);

      let adAccounts: MetaAdAccount[] = (adAccountsData.data || []).map(
        (acc: Record<string, any>) =>
          ({
            id: String(acc.id || ""),
            name: String(acc.name || ""),
            currency: String(acc.currency || "USD"),
            timezone_name: String(acc.timezone_name || "UTC"),
            account_status: Number(acc.account_status ?? 1),
            spend_cap: acc.spend_cap
              ? parseFloat(String(acc.spend_cap))
              : undefined,
            amount_spent: acc.amount_spent
              ? parseFloat(String(acc.amount_spent))
              : undefined,
            business_id: acc.business?.id,
            business_name: acc.business?.name,
          }) as MetaAdAccount
      );


      // If no ad accounts found directly, try fetching through businesses
      if (adAccounts.length === 0 && (businessesData.data?.length || 0) > 0) {
        const allBusinessAdAccounts = [];

        for (const business of businessesData.data as Array<
          Record<string, any>
        >) {
          const businessAdAccountsRes = await fetch(
            `https://graph.facebook.com/${VERSION}/${String(business.id)}/adaccounts?fields=id,name,currency,timezone_name,account_status,spend_cap,amount_spent&limit=100&access_token=${accessToken}`
          );
          const businessAdAccountsData = await businessAdAccountsRes.json();

          if (businessAdAccountsData.data) {
            allBusinessAdAccounts.push(...businessAdAccountsData.data);
          }
        }

        if (allBusinessAdAccounts.length > 0) {
          adAccounts = allBusinessAdAccounts.map(
            (acc: Record<string, any>) =>
              ({
                id: String(acc.id || ""),
                name: String(acc.name || ""),
                currency: String(acc.currency || "USD"),
                timezone_name: String(acc.timezone_name || "UTC"),
                account_status: Number(acc.account_status ?? 1),
                spend_cap: acc.spend_cap
                  ? parseFloat(String(acc.spend_cap))
                  : undefined,
                amount_spent: acc.amount_spent
                  ? parseFloat(String(acc.amount_spent))
                  : undefined,
                business_id: acc.business?.id,
                business_name: acc.business?.name,
              }) as MetaAdAccount
          );

          // fallback details omitted in production logs
        }
      }

      // Store the accounts if found
      if (adAccounts.length > 0) {
        await ctx.runMutation(
          api.integrations.meta.storeAdAccountsFromCallback,
          {
            accounts: adAccounts,
          }
        );
        console.log(`[Meta] oauth.accounts.stored`, {
          org: String(user.organizationId),
          user: String(user._id),
          count: adAccounts.length,
        });
      }

      // Normalize to return shape expected by validator (camelCase keys)
      const accountsForReturn = adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        timezone: a.timezone ?? a.timezone_name,
        accountStatus: a.accountStatus ?? a.account_status,
        spendCap:
          a.spendCap !== undefined
            ? Number(a.spendCap)
            : a.spend_cap !== undefined
              ? Number(a.spend_cap)
              : undefined,
        amountSpent:
          a.amountSpent !== undefined
            ? Number(a.amountSpent)
            : a.amount_spent !== undefined
              ? Number(a.amount_spent)
              : undefined,
        business_id: a.business_id ?? a.business?.id,
        business_name: a.business_name ?? a.business?.name,
      }));

      return { success: true, accounts: accountsForReturn };
    } catch (error) {
      console.error("Error fetching Meta accounts:", error);

      return {
        success: false,
        accounts: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get single campaign
 */
export const getCampaign = query({
  args: {
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    // TODO: metaCampaigns table doesn't exist in schema yet
    // Return mock data for now
    return {
      id: args.campaignId,
      name: "Campaign",
      status: "active",
      objective: "conversions",
      budget: 1000,
      spend: 500,
    };
  },
});

/**
 * Get campaign performance metrics
 */
export const getCampaignPerformance = query({
  args: {
    campaignId: v.string(),
    dateRange: v.optional(
      v.object({
        start: v.string(),
        end: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    // Get insights for this campaign
    let insights = await ctx.db
      .query("metaInsights")
      .withIndex("by_entity_date", (q) =>
        q.eq("entityType", "campaign").eq("entityId", args.campaignId)
      )
      .collect();

    // Filter by date range if provided
    if (args.dateRange?.start && args.dateRange.end) {
      const { start, end } = args.dateRange;
      insights = insights.filter((i) => i.date >= start && i.date <= end);
    }

    // Aggregate metrics
    const totalSpend = insights.reduce((sum, i) => sum + (i.spend || 0), 0);
    const totalImpressions = insights.reduce(
      (sum, i) => sum + (i.impressions || 0),
      0
    );
    const totalClicks = insights.reduce((sum, i) => sum + (i.clicks || 0), 0);
    const totalPurchases = insights.reduce(
      (sum, i) => sum + (i.conversions || 0),
      0
    );
    const totalPurchaseValue = insights.reduce(
      (sum, i) => sum + (i.conversionValue || 0),
      0
    );

    return {
      campaignId: args.campaignId,
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      conversions: totalPurchases,
      conversionValue: totalPurchaseValue,
      roas: totalSpend > 0 ? totalPurchaseValue / totalSpend : 0,
      dateRange: args.dateRange,
    };
  },
});

/**
 * Get audience insights
 */
export const getAudienceInsights = query({
  args: {
    accountId: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    // Return mock audience insights for now
    return {
      demographics: {
        age: [
          { range: "18-24", percentage: 15 },
          { range: "25-34", percentage: 35 },
          { range: "35-44", percentage: 25 },
          { range: "45-54", percentage: 15 },
          { range: "55+", percentage: 10 },
        ],
        gender: [
          { type: "male", percentage: 45 },
          { type: "female", percentage: 55 },
        ],
      },
      geography: [
        { country: "US", percentage: 60 },
        { country: "UK", percentage: 20 },
        { country: "CA", percentage: 10 },
        { country: "AU", percentage: 10 },
      ],
      interests: [
        { name: "Shopping", score: 0.9 },
        { name: "Technology", score: 0.8 },
        { name: "Fashion", score: 0.7 },
      ],
    };
  },
});

/**
 * Get ad sets
 */
export const getAdSets = query({
  args: {
    campaignId: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    // TODO: metaAdSets table doesn't exist in schema yet
    // Return empty array until table is created
    return [];
  },
});

/**
 * Get ads
 */
export const getAds = query({
  args: {
    adSetId: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return [];
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return [];

    // TODO: metaAds table doesn't exist in schema yet
    // Return empty array until table is created
    return [];
  },
});

/**
 * Trigger sync
 */
export const triggerSync = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async () => ({ success: false, message: "Manual sync disabled" }),
});

/**
 * Get sync status
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;
    const user = await ctx.db.get(userId);

    if (!user?.organizationId) return null;

    // Get the latest sync session for Meta
    const syncSession = await ctx.db
      .query("syncSessions")
      .withIndex("by_org_platform_and_date", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("platform", "meta"),
      )
      .order("desc")
      .first();

    if (!syncSession) {
      return {
        status: "idle",
        lastSync: null,
        nextSync: null,
      };
    }

    return {
      status: syncSession.status,
      lastSync: syncSession.completedAt || syncSession.startedAt,
      nextSync: null, // TODO: Calculate next sync time
      // progress field removed from schema
      recordsProcessed: syncSession.recordsProcessed,
    };
  },
});

 
