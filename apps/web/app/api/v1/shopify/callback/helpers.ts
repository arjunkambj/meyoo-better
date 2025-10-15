import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/libs/convexApi";
import { ShopifyGraphQLClient } from "@/libs/shopify/ShopifyGraphQLClient";
import { registerWebhooks } from "@/libs/shopify/webhook-register";
import { createLogger } from "@/libs/logging/Logger";
import { optionalEnv, requireEnv } from "@/libs/env";
import type { Session } from "@shopify/shopify-api";
import type { GenericId as Id } from "convex/values";
import { createShopProvisionSignature } from "@/libs/shopify/signature";

export { normalizeShopDomain } from "@/libs/shopify/domain";

const logger = createLogger("Shopify.Callback.Helpers");
const NEXT_PUBLIC_APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");
const SHOPIFY_WEBHOOK_DEBUG = optionalEnv("SHOPIFY_WEBHOOK_DEBUG") === "1";

/**
 * Fetches shop data from Shopify GraphQL API
 */
export async function fetchShopData(session: Session): Promise<Record<string, unknown>> {
  try {
    const client = new ShopifyGraphQLClient({
      shopDomain: session.shop,
      accessToken: session.accessToken || "",
    });
    const response = await client.getShopInfo();
    const shopInfo = response.data?.shop;

    if (shopInfo) {
      return {
        email: shopInfo.email,
        shopName: shopInfo.name,
        currency: shopInfo.currencyCode,
        timezone: shopInfo.ianaTimezone ?? shopInfo.timezoneAbbreviation,
        timezoneAbbreviation: shopInfo.timezoneAbbreviation,
        timezoneOffsetMinutes: shopInfo.timezoneOffsetMinutes,
        country: shopInfo.billingAddress?.country,
      };
    }
    return {};
  } catch (error) {
    logger.error("Failed to fetch shop data", error as Error);
    return {};
  }
}

export const createAuthSignature = createShopProvisionSignature;

/**
 * Registers webhooks for a Shopify store
 */
export async function registerStoreWebhooks(
  session: Session,
  token?: string,
): Promise<boolean> {
  try {
    const webhookStatus = await fetchMutation(
      api.shopify.publicMutations.checkAndSetWebhooksRegistered,
      { shopDomain: session.shop },
      token ? { token } : undefined,
    );

    if (webhookStatus.shouldRegister) {
      const reg = await registerWebhooks(session);
      if (!reg.success) {
        logger.warn("Webhook registration incomplete, resetting flag");
        await fetchMutation(
          api.shopify.publicMutations.setWebhooksRegisteredByDomain,
          { shopDomain: session.shop, value: false },
          token ? { token } : undefined,
        );
        return false;
      }
      // Only log success in debug mode
      if (SHOPIFY_WEBHOOK_DEBUG) {
        logger.info("Shopify webhooks registered");
      }
      return true;
    }
    return webhookStatus.alreadyRegistered || false;
  } catch (error) {
    logger.error("Webhook registration check failed", error as Error);
    return false;
  }
}

/**
 * Triggers initial sync for a new Shopify connection
 */
export async function triggerInitialSync(
  token: string,
  organizationId: Id<"organizations">,
): Promise<void> {
  try {
    // Check if any Shopify products exist yet for this org
    const products = await fetchQuery(
      api.shopify.publicQueries.getProducts,
      { limit: 1 },
      { token },
    );

    const hasAnyProduct = Boolean(products && products.length > 0);

    // Also check if a completed Shopify sync exists
    let hasCompletedSync = false;
    try {
      const sessions = await fetchQuery(
        api.web.sync.getSyncSessions,
        { limit: 5, platform: "shopify", status: "completed" },
        { token },
      );
      hasCompletedSync = Boolean(
        sessions?.some(
          (session) =>
            session.syncType === "initial" && session.recordsProcessed > 0,
        ),
      );
    } catch {
      // Ignore error, proceed with sync
    }

    if (!hasAnyProduct || !hasCompletedSync) {
      await fetchMutation(
        api.engine.syncJobs.triggerInitialSync,
        {
          organizationId,
          platform: "shopify",
          dateRange: { daysBack: 60 },
        },
        { token },
      );
    }
  } catch (error) {
    logger.error("Initial sync scheduling check failed", error as Error);
  }
}

/**
 * Sets auth cookies for Convex session
 */
export function setAuthCookies(
  response: NextResponse,
  tokens: { token: string; refreshToken: string },
): void {
  const prefix = "__Host-";
  const common = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  };

  response.cookies.set(`${prefix}__convexAuthJWT`, tokens.token, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(`${prefix}__convexAuthRefreshToken`, tokens.refreshToken, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(`${prefix}__convexAuthOAuthVerifier`, "", {
    ...common,
    expires: new Date(0),
  });
}

/**
 * Determines the redirect URL based on onboarding status
 */
export async function getRedirectUrl(
  token: string,
  shopDomain: string,
): Promise<string> {
  const baseUrl = NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");

  try {
    const status = await fetchQuery(
      api.core.onboarding.getOnboardingStatus,
      {},
      { token },
    );

    if (status?.completed) {
      return `${baseUrl}/overview`;
    }

    if (status?.connections?.shopify && status?.hasShopifySubscription) {
      return `${baseUrl}/onboarding/marketing`;
    }

    return `${baseUrl}/onboarding/billing?shop=${encodeURIComponent(shopDomain)}`;
  } catch {
    // Fallback to billing page on error
    return `${baseUrl}/onboarding/billing?shop=${encodeURIComponent(shopDomain)}`;
  }
}

/**
 * Retry wrapper for Convex calls with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        const delay = 200 * 2 ** i;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError ?? new Error(`${label} failed after ${maxRetries} attempts`);
}
