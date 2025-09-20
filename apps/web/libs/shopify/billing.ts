import type { Session } from "@shopify/shopify-api";

import { createLogger } from "../logging";

import shopify, { resolvedHostScheme } from "./shopify";

const logger = createLogger("shopify-billing");

interface BillingCheckResult {
  hasActivePayment: boolean;
  confirmationUrl?: string;
}

/**
 * Get the Shopify app handle from environment or use default
 * This should match your app handle in Shopify Partners Dashboard
 */
export function getAppHandle(): string {
  const handle = process.env.SHOPIFY_APP_HANDLE?.trim();
  if (!handle) {
    logger.error(
      "[Billing] SHOPIFY_APP_HANDLE is missing. Set it to your app handle in env.",
    );
    throw new Error(
      "SHOPIFY_APP_HANDLE is not set. Please configure it in your environment.",
    );
  }

  // Basic sanity: Shopify app handles are usually slug-like
  const valid = /^[a-z0-9-]+$/i.test(handle);
  if (!valid) {
    logger.error("[Billing] SHOPIFY_APP_HANDLE has invalid characters", {
      handle,
    });
    throw new Error("Invalid SHOPIFY_APP_HANDLE. Use a slug-like value.");
  }

  return handle;
}

/**
 * Check if the merchant has an active payment/subscription using GraphQL
 * For managed pricing, we query the current app subscriptions directly
 */
export async function checkBillingStatus(
  session: Session,
  _organizationTrialInfo?: unknown,
  isTest: boolean = process.env.NODE_ENV !== "production",
): Promise<BillingCheckResult> {
  try {
    logger.info("[Billing] Checking billing status for shop", {
      shop: session.shop,
      isTest,
      trialInfo: undefined,
    });

    // For managed pricing, query active subscriptions via GraphQL
    const client = new shopify.clients.Graphql({ session });

    const query = `
      query currentAppInstallation {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            trialDays
            currentPeriodEnd
            createdAt
            lineItems {
              id
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await client.request(query);
      const subscriptions =
        response?.data?.currentAppInstallation?.activeSubscriptions || [];

      // Check if any subscription is ACTIVE
      const hasActivePayment = subscriptions.some(
        (sub: any) =>
          sub.status === "ACTIVE" && (!isTest || sub.test === isTest),
      );

      logger.info("[Billing] GraphQL billing check result", {
        shop: session.shop,
        hasActivePayment,
        subscriptionCount: subscriptions.length,
        subscriptions: subscriptions.map((s: any) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          test: s.test,
        })),
      });

      return {
        hasActivePayment,
      };
    } catch (gqlError) {
      // Fallback to SDK method if GraphQL fails
      logger.warn("[Billing] GraphQL query failed, falling back to SDK", {
        error: gqlError instanceof Error ? gqlError.message : "Unknown error",
      });

      // Try using the subscriptions method as fallback
      try {
        const subscriptions = await shopify.billing.subscriptions({ session });
        const hasActivePayment =
          Array.isArray(subscriptions) && subscriptions.length > 0;

        logger.info("[Billing] SDK fallback result", {
          shop: session.shop,
          hasActivePayment,
          subscriptionCount: Array.isArray(subscriptions)
            ? subscriptions.length
            : 0,
        });

        return {
          hasActivePayment,
        };
      } catch (sdkError) {
        logger.error("[Billing] Both GraphQL and SDK methods failed", {
          shop: session.shop,
          error: sdkError instanceof Error ? sdkError.message : "Unknown error",
        });

        // Return false as safe default when both methods fail
        return {
          hasActivePayment: false,
        };
      }
    }
  } catch (error) {
    logger.error("[Billing] Error checking billing status", {
      shop: session.shop,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Create a redirect URL to Shopify's managed pricing page
 * This is the recommended approach for apps using Shopify Managed Pricing
 *
 * @param shop - The shop domain (e.g., "mystore.myshopify.com")
 * @param returnUrl - URL to return to after plan selection
 * @returns The URL to redirect the merchant to
 */
export function createManagedPricingRedirectUrl(
  shop: string,
  returnUrl?: string,
): string {
  // Extract store handle from shop domain
  // e.g., "mystore.myshopify.com" -> "mystore"
  const storeHandle = shop.replace(".myshopify.com", "");
  const appHandle = getAppHandle();

  // Build the managed pricing URL
  const baseUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  let finalUrl = baseUrl;

  // Add return URL if provided
  if (returnUrl) {
    // Normalize returnUrl to include scheme if missing
    const normalizedReturnUrl = /^https?:\/\//i.test(returnUrl)
      ? returnUrl
      : `${resolvedHostScheme}://${returnUrl.replace(/^\/+/, "")}`;
    const url = new URL(baseUrl);

    url.searchParams.set("return_url", normalizedReturnUrl);
    finalUrl = url.toString();
  }

  logger.info("[Billing] Created managed pricing redirect URL", {
    shop,
    storeHandle,
    appHandle,
    redirectUrl: finalUrl,
    hasReturnUrl: !!returnUrl,
  });

  return finalUrl;
}

/**
 * Check if the current order count is within the plan limits
 * This should be called periodically to enforce plan limits
 */
export async function checkOrderLimits(
  shop: string,
  currentOrderCount: number,
): Promise<{
  withinLimits: boolean;
  planLimit?: number;
  upgradeRequired: boolean;
}> {
  // Plan limits based on SHOPIFY_PRICING_DETAILS.md
  const PLAN_LIMITS = {
    FREE: 300,
    STARTER: 1200,
    GROWTH: 3500,
    BUSINESS: 7500,
  };

  // Plan detection would need to be implemented based on subscription details
  // For now, using default limit for demonstration

  logger.info("[Billing] Checking order limits", {
    shop,
    currentOrderCount,
  });

  // This is a simplified check - you'll need to implement actual plan detection
  // based on the subscription details from Shopify
  const planLimit = PLAN_LIMITS.FREE; // Default to free tier

  const withinLimits = currentOrderCount < planLimit;
  const upgradeRequired = !withinLimits;

  return {
    withinLimits,
    planLimit,
    upgradeRequired,
  };
}

/**
 * Helper to determine if we should show upgrade prompts
 * When merchants are approaching their plan limits
 */
export function shouldShowUpgradePrompt(
  currentUsage: number,
  planLimit: number,
): boolean {
  const usagePercentage = (currentUsage / planLimit) * 100;

  // Show upgrade prompt when usage is above 80%
  return usagePercentage > 80;
}

// Removed managed pricing redirect - now using GraphQL subscription creation
