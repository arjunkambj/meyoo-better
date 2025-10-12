import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, mutation } from "./_generated/server";
import { normalizeShopDomain } from "./utils/shop";
import { verifyShopProvisionSignature } from "./utils/crypto";
import { ensureActiveMembership, findExistingUser, normalizeEmail } from "./authHelpers";
import { ensureShopifyOnboarding } from "./utils/onboarding";
import { isIanaTimeZone } from "@repo/time";
import { optionalEnv } from "./utils/env";

const SHOPIFY_API_VERSION = optionalEnv("SHOPIFY_API_VERSION") ?? "2025-07";

export const createOrAttachFromShopifyOAuth = mutation({
  args: {
    shop: v.string(),
    accessToken: v.string(),
    scope: v.string(),
    nonce: v.string(),
    sig: v.string(),
    shopData: v.optional(
      v.object({
        email: v.optional(v.string()),
        shopName: v.optional(v.string()),
        currency: v.optional(v.string()),
        timezone: v.optional(v.string()),
        country: v.optional(v.string()),
        timezoneAbbreviation: v.optional(v.string()),
        timezoneOffsetMinutes: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    success: v.boolean(),
    organizationId: v.string(),
    userId: v.string(),
    shop: v.string(),
  }),
  handler: async (ctx, args) => {
    const ok = await verifyShopProvisionSignature(
      args.shop,
      args.nonce,
      args.sig,
    );
    if (!ok) throw new Error("Unauthorized provisioning request");

    const now = Date.now();
    const shop = normalizeShopDomain(args.shop);

    // IMPORTANT: Preserve existing store-user link if store already exists.
    // First, check if the store is already provisioned for any user/org.
    const existingStore = await ctx.db
      .query("shopifyStores")
      .withIndex("by_shop_domain", (q) => q.eq("shopDomain", shop))
      .first();
    let user: Doc<"users"> | null = null;
    let organizationId: Id<"organizations"> | undefined;

    if (existingStore) {
      // Store already linked – do NOT reassign user/organization based on email.
      user = await ctx.db.get(existingStore.userId);
      organizationId = existingStore.organizationId as Id<"organizations">;

      // Soft update store details and credentials only.
      await ctx.db.patch(existingStore._id, {
        storeName:
          args.shopData?.shopName || existingStore.storeName || shop,
        primaryCurrency:
          args.shopData?.currency || existingStore.primaryCurrency || "USD",
        operatingCountry:
          args.shopData?.country || existingStore.operatingCountry,
        accessToken: args.accessToken,
        scope: args.scope,
        isActive: true,
        // Preserve current webhook registration flag as-is; do not apply legacy defaults
        webhooksRegistered: existingStore.webhooksRegistered,
        updatedAt: now,
      });
    } else {
      // No existing store – resolve/create user from Shopify email (but never overwrite existing user emails)
      const email = args.shopData?.email
        ? normalizeEmail(args.shopData.email)
        : undefined;
      if (email) {
        user = await findExistingUser(ctx as any, email);
      }
      if (!user) {
        const fallbackEmail = email || `owner@${shop}`;
        const name = args.shopData?.shopName || shop;
        const userId = await ctx.db.insert("users", {
          email: fallbackEmail.trim().toLowerCase(), // Always normalize when creating
          name,
          status: "active",
          isOnboarded: false,
          loginCount: 0,
          lastLoginAt: now,
          createdAt: now,
        });
        user = await ctx.db.get(userId);
      }
      if (!user) throw new Error("Failed to create or load user");

      organizationId = user.organizationId as Id<"organizations"> | undefined;
      if (!organizationId) {
        organizationId = await ctx.db.insert("organizations", {
          name:
            args.shopData?.shopName || `${user.name || "Store Owner"}'s Store`,
          ownerId: user._id,
          isPremium: false,
          requiresUpgrade: false,
          locale: "en-US",
          timezone:
            isIanaTimeZone(args.shopData?.timezone)
              ? (args.shopData?.timezone as string)
              : undefined, // leave undefined if not a valid IANA zone
          primaryCurrency: args.shopData?.currency || "USD",
          createdAt: now,
        });
        await ctx.db.patch(user._id, { organizationId });
      }

      await ctx.db.insert("shopifyStores", {
        organizationId: organizationId as Id<"organizations">,
        userId: user._id,
        shopDomain: shop,
        storeName: args.shopData?.shopName || shop,
        storeEmail: args.shopData?.email || "", // Keep store email separate from user email
        accessToken: args.accessToken,
        scope: args.scope,
        operatingCountry: args.shopData?.country,
        primaryCurrency: args.shopData?.currency || "USD",
        isGlobalStore: false,
        apiVersion: SHOPIFY_API_VERSION,
        webhooksRegistered: false,
        isActive: true,
        lastSyncAt: undefined,
        updatedAt: now,
      });
    }

    // Ensure onboarding record exists and reflects Shopify connection for the preserved/created user/org
    if (!user || !organizationId)
      throw new Error("Missing user or org context");

    const orgId = organizationId as Id<"organizations">;
    const currentOrg = await ctx.db.get(orgId);
    const incomingCurrency =
      args.shopData?.currency ||
      existingStore?.primaryCurrency ||
      currentOrg?.primaryCurrency ||
      undefined;
    const incomingTimezone = isIanaTimeZone(args.shopData?.timezone)
      ? (args.shopData?.timezone as string)
      : undefined;
    const orgUpdates: Partial<Doc<"organizations">> = {};

    if (incomingCurrency && incomingCurrency !== currentOrg?.primaryCurrency) {
      orgUpdates.primaryCurrency = incomingCurrency;
    }
    if (incomingTimezone && incomingTimezone !== currentOrg?.timezone) {
      orgUpdates.timezone = incomingTimezone;
    }
    if (Object.keys(orgUpdates).length > 0) {
      orgUpdates.updatedAt = now;
      await ctx.db.patch(orgId, orgUpdates);
    }

    await ensureActiveMembership(
      ctx,
      orgId,
      user._id as Id<'users'>,
      "StoreOwner",
      {
        assignedAt: now,
        assignedBy: user._id as Id<'users'>,
      },
    );

    await ensureShopifyOnboarding(
      ctx,
      user._id as Id<'users'>,
      orgId,
      now,
    );

    // After provisioning, trigger initial Shopify sync if not already synced
    try {
      // Check if there's any prior sync session for this org + platform
      const lastCompletedInitial = await ctx.db
        .query("syncSessions")
        .withIndex("by_org_platform_and_status", (q) =>
          q
            .eq("organizationId", organizationId as Id<"organizations">)
            .eq("platform", "shopify")
            .eq("status", "completed"),
        )
        .order("desc")
        .first();

      const alreadySynced =
        Boolean(lastCompletedInitial) &&
        (lastCompletedInitial!.type === "initial" ||
          lastCompletedInitial!.metadata?.isInitialSync === true) &&
        (lastCompletedInitial!.recordsProcessed ?? 0) > 0;

      // Also respect onboarding flag if present
      const shouldSync = !alreadySynced;

      if (shouldSync) {
        await ctx.runMutation(
          internal.engine.syncJobs.triggerInitialSyncInternal,
          {
            organizationId: organizationId as Id<"organizations">,
            platform: "shopify",
            dateRange: { daysBack: 60 },
            userId: user._id,
          } as any,
        );
      }
    } catch (e) {
      console.error("[Install] Failed to enqueue initial Shopify sync", e);
      // non-fatal: continue
    }

    return {
      success: true,
      organizationId: organizationId as unknown as string,
      userId: user._id as unknown as string,
      shop: shop,
    };
  },
});

export const issueTokensFromShopifyOAuth = action({
  args: {
    shop: v.string(),
    nonce: v.string(),
    sig: v.string(),
  },
  returns: v.object({ token: v.string(), refreshToken: v.string() }),
  handler: async (ctx, args) => {
    const ok = await verifyShopProvisionSignature(
      args.shop,
      args.nonce,
      args.sig,
    );
    if (!ok) throw new Error("Unauthorized");

    const shop = normalizeShopDomain(args.shop);
    const store = (await ctx.runQuery(
      internal.integrations.shopify.getStoreByDomain,
      { shopDomain: shop },
    )) as { userId?: Id<"users"> } | null;
    if (!store?.userId) throw new Error("Store not found");

    const authResult = (await ctx.runMutation(internal.auth.store, {
      args: {
        type: "signIn",
        userId: store.userId,
        generateTokens: true,
      },
    })) as any;

    const token = authResult?.token ?? authResult?.tokens?.token;
    const refreshToken =
      authResult?.refreshToken ?? authResult?.tokens?.refreshToken;

    if (!token || !refreshToken) {
      throw new Error("Failed to issue auth tokens");
    }

    return { token, refreshToken };
  },
});
