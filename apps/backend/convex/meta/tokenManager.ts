import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createSimpleLogger } from "../../libs/logging/simple";
import { optionalEnv } from "../utils/env";

const logger = createSimpleLogger("TokenManager");
const META_APP_ID = optionalEnv("META_APP_ID");

type Platform = "meta";

type GetValidAccessTokenArgs = {
  organizationId: Id<"organizations">;
  platform: Platform;
};

async function getValidAccessTokenImpl(
  ctx: any,
  args: GetValidAccessTokenArgs,
): Promise<string> {
  const session = await ctx.runQuery(
    internal.meta.tokenManager.getActiveSessionInternal,
    {
      organizationId: args.organizationId,
      platform: args.platform,
    },
  );

  if (!session) {
    throw new Error(
      `No active integration session for ${args.platform} in org ${args.organizationId}`,
    );
  }

  const now = Date.now();
  const skewMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const expiringSoon =
    typeof session.expiresAt === "number" && session.expiresAt - now < skewMs;

  if (args.platform === "meta") {
    if (!session.expiresAt || expiringSoon) {
      try {
        // Validate token app ownership before attempting exchange
        const { debugToken } = await import("./tokens");
        const info = await debugToken(session.accessToken);
        const desiredAppId = META_APP_ID;
        const tokenAppId = info?.data?.app_id ?? info?.app_id;

        // Persist appId and last check
        await ctx.runMutation(
          internal.meta.tokenManager.updateSessionTokenInternal,
          {
            sessionId: session._id,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt,
            metadata: {
              ...(session.metadata || {}),
              appId: tokenAppId,
              appIdCheckedAt: Date.now(),
              appMismatch: Boolean(
                desiredAppId && tokenAppId && desiredAppId !== tokenAppId,
              ),
            },
          },
        );

        if (desiredAppId && tokenAppId && desiredAppId !== tokenAppId) {
          logger.error("Meta token app mismatch", {
            desiredAppId,
            tokenAppId,
            sessionId: session._id,
          });
          // Do not attempt exchange with the wrong app; continue using current token
          return session.accessToken;
        }
      } catch (e) {
        // If debug fails, proceed but avoid log spam
        logger.warn("Meta token debug failed", { error: String(e) });
      }
      try {
        const { exchangeForLongLivedUserToken } = await import("./tokens");
        const exchanged = await exchangeForLongLivedUserToken(
          session.accessToken,
        );
        if (exchanged?.access_token) {
          const ttlSec = exchanged.expires_in ?? 60 * 24 * 60 * 60;
          await ctx.runMutation(
            internal.meta.tokenManager.updateSessionTokenInternal,
            {
              sessionId: session._id,
              accessToken: exchanged.access_token,
              expiresAt: now + ttlSec * 1000,
              metadata: {
                tokenKind: "long",
                lastRefreshedAt: now,
                shortLivedAccessToken:
                  session.metadata?.shortLivedAccessToken || session.accessToken,
              },
            },
          );
          return exchanged.access_token;
        }
      } catch (e) {
        logger.warn("Meta token re-exchange failed", { error: String(e) });
      }
    }
    return session.accessToken;
  }

  return session.accessToken;
}

export const getValidAccessToken = internalAction({
  args: {
    organizationId: v.id("organizations"),
    platform: v.literal("meta"),
  },
  handler: async (ctx, args): Promise<string> => {
    return getValidAccessTokenImpl(ctx, args as GetValidAccessTokenArgs);
  },
});

export const refreshExpiring = internalAction({
  args: {
    lookaheadHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lookaheadMs = (args.lookaheadHours ?? 72) * 60 * 60 * 1000;
    const now = Date.now();
    const allSessions = await ctx.runQuery(
      internal.meta.tokenManager.listAllActiveSessionsInternal,
      {},
    );
    const target = allSessions.filter(
      (s: any) =>
        s.isActive &&
        s.platform === "meta" &&
        typeof s.expiresAt === "number" &&
        s.expiresAt - now < lookaheadMs,
    );
    logger.info("Refreshing expiring tokens", { count: target.length });
    for (const s of target) {
      try {
        await getValidAccessTokenImpl(ctx as any, {
          organizationId: s.organizationId as Id<"organizations">,
          platform: s.platform as Platform,
        });
      } catch (e) {
        logger.warn("Failed to refresh token", {
          platform: s.platform,
          sessionId: s._id,
          error: String(e),
        });
      }
    }
  },
});

export const getActiveSessionInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    platform: v.literal("meta"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationSessions")
      .withIndex("by_org_platform_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("platform", args.platform)
          .eq("isActive", true),
      )
      .first();
  },
});

export const updateSessionTokenInternal = internalMutation({
  args: {
    sessionId: v.id("integrationSessions"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      updatedAt: Date.now(),
      metadata: {
        ...(args.metadata || {}),
      },
    });
  },
});

export const listAllActiveSessionsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("integrationSessions")
      .withIndex("by_is_active", (q) => q.eq("isActive", true))
      .collect();
    return sessions;
  },
});
