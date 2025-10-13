import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { META_CONFIG } from "../../libs/meta/meta.config";
import type { MetaAdAccount } from "./types";

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
      }),
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return { success: false, accounts: [], error: "Not authenticated" };
      }

      const user = await ctx.runQuery(api.core.users.getCurrentUser);
      if (!user?.organizationId) {
        return {
          success: false,
          accounts: [],
          error: "User or organization not found",
        };
      }

      const session = await ctx.runQuery(
        internal.meta.internal.getIntegrationSession,
        {
          organizationId: user.organizationId,
        },
      );

      if (!session) {
        return {
          success: false,
          accounts: [],
          error: "No Meta integration found",
        };
      }

      const accessToken = await ctx.runAction(
        internal.meta.tokenManager.getValidAccessToken,
        {
          organizationId: user.organizationId as Id<"organizations">,
          platform: "meta",
        },
      );

      const version = META_CONFIG.API_VERSION;
      const [adAccountsRes, businessesRes] = await Promise.all([
        fetch(
          `https://graph.facebook.com/${version}/me/adaccounts?fields=id,name,currency,timezone_name,account_status,spend_cap,amount_spent,business&limit=100&access_token=${accessToken}`,
        ),
        fetch(
          `https://graph.facebook.com/${version}/me/businesses?access_token=${accessToken}`,
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
          }) as MetaAdAccount,
      );

      if (adAccounts.length === 0 && (businessesData.data?.length || 0) > 0) {
        const allBusinessAdAccounts: Array<Record<string, any>> = [];

        for (const business of businessesData.data as Array<Record<string, any>>) {
          const businessRes = await fetch(
            `https://graph.facebook.com/${version}/${String(business.id)}/adaccounts?fields=id,name,currency,timezone_name,account_status,spend_cap,amount_spent&limit=100&access_token=${accessToken}`,
          );
          const businessData = await businessRes.json();

          if (businessData.data) {
            allBusinessAdAccounts.push(...businessData.data);
          }
        }

        if (allBusinessAdAccounts.length > 0) {
          adAccounts = allBusinessAdAccounts.map((acc: Record<string, any>) =>
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
            }) as MetaAdAccount,
          );
        }
      }

      if (adAccounts.length > 0) {
        await ctx.runMutation(api.meta.mutations.storeAdAccountsFromCallback, {
          accounts: adAccounts,
        });
      }

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
      return {
        success: false,
        accounts: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

