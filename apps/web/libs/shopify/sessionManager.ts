import { Session } from "@shopify/shopify-api";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/libs/convexApi";
import { createLogger } from "@/libs/logging/Logger";

const logger = createLogger("Shopify.SessionManager");

export interface ShopifySessionData {
  shop: string;
  accessToken: string;
  scope: string;
  isOnline: boolean;
  expires?: Date;
}

/**
 * Get session by shop domain
 */
export async function getSessionByShop(
  shopDomain: string,
): Promise<Session | null> {
  try {
    logger.info("Getting session by shop domain", { shopDomain });

    // Get store data from database
    const store = await fetchQuery(
      api.shopify.publicQueries.getPublicStoreByDomain,
      { shopDomain },
      { token: undefined }, // Admin query
    );

    if (!store) {
      logger.warn("No store found for shop domain", { shopDomain });

      return null;
    }

    if (!store.accessToken) {
      logger.warn("No access token found for store", { shopDomain });

      return null;
    }

    // Create a proper Shopify Session object
    const session = new Session({
      id: `offline_${shopDomain}`,
      shop: shopDomain,
      state: "offline",
      isOnline: false,
      accessToken: store.accessToken,
      scope: store.scope || "",
    });

    logger.info("Session retrieved successfully", {
      shopDomain,
      hasAccessToken: !!session.accessToken,
      scope: session.scope,
    });

    return session;
  } catch (error) {
    logger.error("Error retrieving session by shop", error as Error, {
      shopDomain,
    });

    return null;
  }
}

/**
 * Get session by organization ID
 */
export async function getSessionByOrganization(
  organizationId: string,
): Promise<Session | null> {
  try {
    logger.info("Getting session by organization", { organizationId });

    // Get active store for organization
    const store = await fetchQuery(
      api.shopify.publicQueries.getPublicActiveStore,
      { organizationId },
      { token: undefined }, // Admin query
    );

    if (!store) {
      logger.warn("No active store found for organization", {
        organizationId,
      });

      return null;
    }

    return getSessionByShop(store.shopDomain);
  } catch (error) {
    logger.error("Error retrieving session by organization", error as Error, {
      organizationId,
    });

    return null;
  }
}

/**
 * Get shop domain by organization ID
 */
export async function getShopDomainByOrganization(
  organizationId: string,
): Promise<string | null> {
  try {
    const store = await fetchQuery(
      api.shopify.publicQueries.getPublicActiveStore,
      { organizationId },
      { token: undefined },
    );

    return store?.shopDomain || null;
  } catch (error) {
    logger.error("Error getting shop domain by organization", error as Error, {
      organizationId,
    });

    return null;
  }
}

/**
 * Validate session is still active
 */
export function isSessionValid(session: Session): boolean {
  if (!session.accessToken) {
    return false;
  }

  // Check if session has expired
  if (session.expires && session.expires < new Date()) {
    logger.warn("Session has expired", {
      shop: session.shop,
      expires: session.expires,
    });

    return false;
  }

  return true;
}

/**
 * Get session data for billing operations
 */
export async function getSessionForBilling(
  shopDomain?: string,
  organizationId?: string,
): Promise<Session | null> {
  if (shopDomain) {
    return getSessionByShop(shopDomain);
  }

  if (organizationId) {
    return getSessionByOrganization(organizationId);
  }

  logger.error("No shop domain or organization ID provided for session lookup");

  return null;
}

/**
 * Session retrieval
 */
export async function getShopifySession(
  shopDomain?: string,
  organizationId?: string,
): Promise<Session | null> {
  const session = await getSessionForBilling(shopDomain, organizationId);

  return session;
}

// Export the old class name for backward compatibility
export const ShopifySessionManager = {
  getSessionByShop,
  getSessionByOrganization,
  getShopDomainByOrganization,
  isSessionValid,
  getSessionForBilling,
};
