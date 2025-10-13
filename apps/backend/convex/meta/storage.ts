import type { GenericMutationCtx } from "convex/server";

import { normalizeDateString } from "../utils/date";
import type { DataModel, Id } from "../_generated/dataModel";
import type { MetaAdAccount, MetaInsight } from "./types";

export async function storeAdAccounts(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
  accounts: MetaAdAccount[],
): Promise<void> {
  for (const account of accounts) {
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
      await ctx.db.patch(existing._id, {
        ...accountData,
        syncedAt: existing.syncedAt ?? 0,
      });
    } else {
      const session = await ctx.db
        .query("integrationSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("platform", "meta")
            .eq("isActive", true),
        )
        .first();

      if (session) {
        await ctx.db.insert("metaAdAccounts", {
          organizationId,
          connectionId: session._id,
          accountId: account.id,
          ...accountData,
          syncedAt: 0,
          isPrimary: false,
        });
      }
    }
  }
}

export async function storeCampaigns(
  _ctx: GenericMutationCtx<DataModel>,
  _organizationId: Id<"organizations">,
  _accountId: string,
  _campaigns: unknown[],
): Promise<void> {
  // TODO: Persist campaigns when metaCampaigns table exists
}

export async function storeInsights(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
  accountId: string,
  insights: MetaInsight[],
): Promise<Set<string>> {
  const affectedDates = new Set<string>();

  for (const insight of insights) {
    const existing = await ctx.db
      .query("metaInsights")
      .withIndex("by_entity_date", (q) =>
        q
          .eq("entityType", "account")
          .eq("entityId", accountId)
          .eq("date", insight.date_start || ""),
      )
      .first();

    const insightData = buildInsightData(insight);

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

    const rawDate = insight.date_start ?? insight.date_stop;
    if (rawDate) {
      try {
        affectedDates.add(normalizeDateString(rawDate));
      } catch {
        // Ignore invalid dates
      }
    }
  }

  return affectedDates;
}

function buildInsightData(insight: MetaInsight) {
  return {
    spend: parseMetricValue(insight.spend),
    reach: insight.reach ? parseMetricValue(insight.reach) : undefined,
    impressions: parseMetricValue(insight.impressions),
    frequency: insight.frequency ? parseMetricValue(insight.frequency) : undefined,
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
    engagementRateRanking: insight.engagement_rate_ranking as string | undefined,
    conversionRateRanking: insight.conversion_rate_ranking as string | undefined,
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
}

function parseMetricValue(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getActionValue(
  actions: Array<{ action_type?: string; value?: string | number }> | undefined,
  actionType: string,
): number {
  if (!actions) return 0;
  const target = actionType.toLowerCase();
  const action = actions.find((item) => (item.action_type ?? "").toLowerCase() === target);
  if (!action) return 0;

  const value = action.value;
  if (value == null) return 0;
  return typeof value === "number" ? value : parseMetricValue(value);
}

