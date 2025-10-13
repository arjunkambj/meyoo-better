import type { GenericActionCtx } from "convex/server";

import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import {
  createIntegration,
  IntegrationError,
  SyncUtils,
  type Integration,
  type SyncResult,
} from "../core/integrationBase";
import { META_CONFIG as BACKEND_META_CONFIG } from "../../libs/meta/meta.config";
import {
  fetchAdAccounts,
  fetchCampaigns,
  fetchInsights,
  fetchInsightsSince,
  initializeMetaClient,
} from "./client";
import { metaQueries } from "./queries";

export const meta: Integration = createIntegration({
  name: "meta",
  displayName: "Meta",
  version: "1.0.0",
  icon: "mdi:facebook",

  sync: {
    initial: async (
      ctx: GenericActionCtx<DataModel>,
      args,
    ): Promise<SyncResult> => {
      const dateRange = args.dateRange || SyncUtils.getInitialDateRange(60);

      try {
        const startedAt = Date.now();
        const session = await ctx.runQuery(
          internal.meta.internal.getActiveSessionInternal,
          { organizationId: args.organizationId as Id<"organizations"> },
        );

        if (!session) {
          throw new IntegrationError(
            "No active Meta integration found",
            "SESSION_NOT_FOUND",
            "meta",
          );
        }

        const client = await initializeMetaClient(session);

        let recordsProcessed = 0;
        const errors: string[] = [];

        const adAccounts = await fetchAdAccounts(client);

        await ctx.runMutation(internal.meta.internal.storeAdAccountsInternal, {
          organizationId: args.organizationId as Id<"organizations">,
          accounts: adAccounts,
        });

        const storedAccounts = await ctx.runQuery(
          internal.meta.internal.getStoredAdAccountsInternal,
          { organizationId: args.organizationId as Id<"organizations"> },
        );
        const accountsToSync = storedAccounts.slice(0, 1);

        recordsProcessed += accountsToSync.length;

        for (const account of accountsToSync) {
          try {
            const campaigns = await fetchCampaigns(client, account.accountId, {
              startDate:
                dateRange.startDate || new Date().toISOString().substring(0, 10),
              endDate:
                dateRange.endDate || new Date().toISOString().substring(0, 10),
            });

            await ctx.runMutation(
              internal.meta.internal.storeCampaignsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                campaigns,
              },
            );
            recordsProcessed += campaigns.length;

            const insights = await fetchInsights(client, account.accountId, {
              startDate:
                dateRange.startDate || new Date().toISOString().substring(0, 10),
              endDate:
                dateRange.endDate || new Date().toISOString().substring(0, 10),
            });

            await ctx.runMutation(
              internal.meta.internal.storeInsightsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                insights,
              },
            );
            recordsProcessed += insights.length;
          } catch (error) {
            errors.push(
              `Account ${account.accountName} sync failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        const result = SyncUtils.formatResult(
          errors.length === 0,
          recordsProcessed,
          recordsProcessed > 0,
          errors,
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

    incremental: async (
      ctx: GenericActionCtx<DataModel>,
      args,
    ): Promise<SyncResult> => {
      try {
        const startedAt = Date.now();
        const session = await ctx.runQuery(
          internal.meta.internal.getActiveSessionInternal,
          { organizationId: args.organizationId as Id<"organizations"> },
        );

        if (!session) {
          throw new IntegrationError(
            "No active Meta integration found",
            "SESSION_NOT_FOUND",
            "meta",
          );
        }

        const client = await initializeMetaClient(session);
        const lastSync =
          args.since ||
          (await ctx.runQuery(
            internal.meta.internal.getLastSyncTimeInternal,
            {
              organizationId: args.organizationId as Id<"organizations">,
            },
          ));

        let recordsProcessed = 0;

        const adAccounts = await ctx.runQuery(
          internal.meta.internal.getStoredAdAccountsInternal,
          { organizationId: args.organizationId as Id<"organizations"> },
        );

        for (const account of adAccounts) {
          const insights = await fetchInsightsSince(
            client,
            account.accountId,
            lastSync,
          );

          if (insights.length > 0) {
            await ctx.runMutation(
              internal.meta.internal.storeInsightsInternal,
              {
                organizationId: args.organizationId as Id<"organizations">,
                accountId: account.accountId,
                insights,
              },
            );
            recordsProcessed += insights.length;
          }
        }

        const result = SyncUtils.formatResult(
          true,
          recordsProcessed,
          recordsProcessed > 0,
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

    daily: async (ctx, args) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return meta.sync.incremental(ctx, {
        ...args,
        since: yesterday.toISOString().split("T")[0],
      });
    },

    validate: async (ctx, args) => {
      try {
        const session = await ctx.runQuery(
          internal.meta.internal.getActiveSessionInternal,
          { organizationId: args.organizationId as Id<"organizations"> },
        );

        if (!session) return false;

        const client = await initializeMetaClient(session);
        const user = await client.getMe();
        return !!user;
      } catch {
        return false;
      }
    },
  },

  queries: metaQueries,

  oauth: {
    authorizationUrl: `https://www.facebook.com/${BACKEND_META_CONFIG.API_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${BACKEND_META_CONFIG.API_VERSION}/oauth/access_token`,
    scopes: ["ads_read", "business_management"],
  },

  rateLimit: {
    requests: 200,
    window: 3_600_000,
    concurrent: 5,
  },

  requiredEnvVars: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],

  apiCost: 0.0001,
});

