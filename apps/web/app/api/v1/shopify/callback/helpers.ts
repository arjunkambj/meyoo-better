import crypto from "node:crypto";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/libs/convexApi";
import { ShopifyGraphQLClient } from "@/libs/shopify/ShopifyGraphQLClient";
import { registerWebhooks } from "@/libs/shopify/webhook-register";
import { createLogger } from "@/libs/logging/Logger";
import type { Session } from "@shopify/shopify-api";
import type { GenericId as Id } from "convex/values";

const logger = createLogger("Shopify.Callback.Helpers");

/**
 * Normalizes a shop domain by removing protocol and trailing slashes
 */
export const normalizeShopDomain = (shop: string): string =>
  shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

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
        timezone: shopInfo.timezoneAbbreviation,
        country: shopInfo.billingAddress?.country,
      };
    }
    return {};
  } catch (error) {
    logger.error("Failed to fetch shop data", error as Error);
    return {};
  }
}

/**
 * Creates authentication signature for Shopify OAuth
 */
export function createAuthSignature(shopDomain: string, nonce: string): string {
  const secret = process.env.SHOPIFY_API_KEY || "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${shopDomain}:${nonce}`)
    .digest("hex");
}

/**
 * Registers webhooks for a Shopify store
 */
export async function registerStoreWebhooks(
  session: Session,
  token?: string,
): Promise<boolean> {
  try {
    const webhookStatus = await fetchMutation(
      api.integrations.shopify.checkAndSetWebhooksRegistered,
      { shopDomain: session.shop },
      token 
        ? { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string }
        : { url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
    );

    if (webhookStatus.shouldRegister) {
      const reg = await registerWebhooks(session);
      if (!reg.success) {
        logger.warn("Webhook registration incomplete, resetting flag");
        await fetchMutation(
          api.integrations.shopify.setWebhooksRegisteredByDomain,
          { shopDomain: session.shop, value: false },
          token
            ? { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string }
            : { url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
        );
        return false;
      }
      // Only log success in debug mode
      if (process.env.SHOPIFY_WEBHOOK_DEBUG === "1") {
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
      api.integrations.shopify.getProducts,
      { limit: 1 },
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
    );

    const hasAnyProduct = Boolean(products && products.length > 0);

    // Also check if a completed Shopify sync exists
    let hasCompletedSync = false;
    try {
      const sessions = await fetchQuery(
        api.web.sync.getSyncSessions,
        { limit: 1, platform: "shopify", status: "completed" },
        { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
      );
      hasCompletedSync = Boolean(sessions && sessions.length > 0);
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
        { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
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
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");

  try {
    const status = await fetchQuery(
      api.core.onboarding.getOnboardingStatus,
      {},
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL as string },
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
