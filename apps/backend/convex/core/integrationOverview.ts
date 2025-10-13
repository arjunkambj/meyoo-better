import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { query } from "../_generated/server";

const shopifyStoreValidator = v.object({
  id: v.id("shopifyStores"),
  shopDomain: v.string(),
  storeName: v.string(),
  storeEmail: v.optional(v.string()),
  primaryCurrency: v.optional(v.string()),
  isActive: v.boolean(),
  lastSyncAt: v.optional(v.number()),
});

const metaAccountValidator = v.object({
  id: v.id("metaAdAccounts"),
  accountId: v.string(),
  accountName: v.string(),
  isActive: v.boolean(),
  isPrimary: v.optional(v.boolean()),
  lastSyncAt: v.optional(v.number()),
});

const DEFAULT_RESPONSE = {
  shopify: {
    connected: false,
    store: null,
  },
  meta: {
    connected: false,
    accounts: [] as never[],
    primaryAccountId: null,
    activeAccountCount: 0,
  },
  google: {
    connected: false,
    comingSoon: true,
  },
  hasAnyIntegration: false,
  connectedIntegrations: [] as string[],
  disconnectedIntegrations: ["shopify", "meta", "google"],
};

export const getOverview = query({
  args: {},
  returns: v.object({
    shopify: v.object({
      connected: v.boolean(),
      store: v.union(v.null(), shopifyStoreValidator),
    }),
    meta: v.object({
      connected: v.boolean(),
      accounts: v.array(metaAccountValidator),
      primaryAccountId: v.union(v.null(), v.id("metaAdAccounts")),
      activeAccountCount: v.number(),
    }),
    google: v.object({
      connected: v.boolean(),
      comingSoon: v.boolean(),
    }),
    hasAnyIntegration: v.boolean(),
    connectedIntegrations: v.array(v.string()),
    disconnectedIntegrations: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return DEFAULT_RESPONSE;
    }

    const user = await ctx.db.get(userId);

    if (!user?.organizationId) {
      return DEFAULT_RESPONSE;
    }

    const organizationId = user.organizationId;

    const shopifyStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization_and_active", (q) =>
        q.eq("organizationId", organizationId).eq("isActive", true),
      )
      .first();

    const metaAccounts = await ctx.db
      .query("metaAdAccounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const primaryAccount = metaAccounts.find((account) => account.isPrimary);

    const connectedIntegrations: string[] = [];
    const disconnectedIntegrations: string[] = ["shopify", "meta", "google"];

    if (shopifyStore) {
      connectedIntegrations.push("shopify");
    }

    if (metaAccounts.length > 0) {
      connectedIntegrations.push("meta");
    }

    const connectedSet = new Set(connectedIntegrations);
    const filteredDisconnected = disconnectedIntegrations.filter(
      (platform) => !connectedSet.has(platform),
    );

    return {
      shopify: {
        connected: Boolean(shopifyStore),
        store: shopifyStore
          ? {
              id: shopifyStore._id,
              shopDomain: shopifyStore.shopDomain,
              storeName: shopifyStore.storeName,
              storeEmail: shopifyStore.storeEmail ?? undefined,
              primaryCurrency: shopifyStore.primaryCurrency ?? undefined,
              isActive: shopifyStore.isActive,
              lastSyncAt: shopifyStore.lastSyncAt ?? undefined,
            }
          : null,
      },
      meta: {
        connected: metaAccounts.length > 0,
        accounts: metaAccounts.map((account) => ({
          id: account._id,
          accountId: account.accountId,
          accountName: account.accountName,
          isActive: account.isActive,
          isPrimary: account.isPrimary ?? undefined,
          lastSyncAt: account.syncedAt ?? undefined,
        })),
        primaryAccountId: primaryAccount?._id ?? null,
        activeAccountCount: metaAccounts.filter((account) => account.isActive)
          .length,
      },
      google: {
        connected: false,
        comingSoon: true,
      },
      hasAnyIntegration: connectedIntegrations.length > 0,
      connectedIntegrations,
      disconnectedIntegrations: filteredDisconnected,
    };
  },
});
