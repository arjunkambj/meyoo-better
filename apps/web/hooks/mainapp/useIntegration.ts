import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";

/**
 * Integration Management Hooks
 * Handles Shopify, Meta, and Google integrations
 */

// ============ GENERAL INTEGRATION HOOKS ============

/**
 * Get integration status for all platforms
 */
export function useIntegration() {
  const shopifyStore = useQuery(api.integrations.shopify.getStore);
  const metaAccounts = useQuery(api.integrations.meta.getAdAccounts);
  // TODO: Create disconnectIntegration mutation in convex
  // For now, we'll handle disconnection differently

  const loading = shopifyStore === undefined || metaAccounts === undefined;

  const disconnectMeta = async () => {
    try {
      // TODO: Implement meta disconnection
      // Disconnecting Meta

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  return {
    shopify: {
      connected: !!shopifyStore,
      store: shopifyStore,
      loading: shopifyStore === undefined,
    },
    meta: {
      connected: !!(metaAccounts && metaAccounts.length > 0),
      accounts: metaAccounts || [],
      loading: metaAccounts === undefined,
      disconnect: disconnectMeta,
    },
    google: {
      connected: false,
      accounts: [],
      loading: false,
      comingSoon: true,
      disconnect: async () => ({
        success: false,
        error: "Google Ads integration is currently unavailable.",
      }),
    },
    loading,
    hasAnyIntegration: !!shopifyStore || !!metaAccounts?.length,
  };
}

/**
 * Check integration status for a specific platform
 */
export function useIntegrationStatus(platform: "shopify" | "meta" | "google") {
  const { shopify, meta, google } = useIntegration();

  switch (platform) {
    case "shopify":
      return shopify;
    case "meta":
      return meta;
    case "google":
      return google;
    default:
      return { connected: false, loading: false };
  }
}

// ============ SHOPIFY HOOKS ============

/**
 * Get Shopify store data
 */
export function useShopify() {
  const store = useQuery(api.integrations.shopify.getStore);
  const products = useQuery(api.integrations.shopify.getProducts, {
    limit: 100,
  });
  const orders = useQuery(api.integrations.shopify.getOrders, { limit: 100 });

  return {
    store,
    products: products || [],
    orders: orders || [],
    loading:
      store === undefined || products === undefined || orders === undefined,
    connected: !!store,
  };
}

/**
 * Get Shopify products
 */
export function useShopifyProducts(limit?: number) {
  const products = useQuery(api.integrations.shopify.getProducts, {
    limit: limit || 100,
  });

  return {
    products: products || [],
    loading: products === undefined,
    error: null,
  };
}

/**
 * Get Shopify product variants with product info
 */
export function useShopifyProductVariants(limit?: number) {
  const variants = useQuery(api.integrations.shopify.getProductVariants, {
    limit: limit || 100,
  });

  return {
    products: variants || [],
    loading: variants === undefined,
    error: null,
  };
}

/**
 * Get Shopify product variants with pagination (server-side)
 */
export function useShopifyProductVariantsPaginated(
  page?: number,
  pageSize?: number,
  searchTerm?: string,
) {
  const result = useQuery(
    api.integrations.shopify.getProductVariantsPaginated,
    {
      page,
      pageSize,
      searchTerm,
    },
  );

  return {
    data: result?.data || [],
    totalPages: result?.totalPages || 0,
    totalItems: result?.totalItems || 0,
    currentPage: result?.currentPage || 1,
    loading: result === undefined,
    error: null,
  };
}

/**
 * Get Shopify orders
 */
export function useShopifyOrders(limit?: number, status?: string) {
  const orders = useQuery(api.integrations.shopify.getOrders, {
    limit: limit || 100,
    status,
  });

  return {
    orders: orders || [],
    loading: orders === undefined,
    error: null,
  };
}

// ============ META HOOKS ============

/**
 * Get Meta/Facebook integration data
 */
export function useMeta() {
  const adAccounts = useQuery(api.integrations.meta.getAdAccounts);
  const insights = useQuery(api.integrations.meta.getInsights, {});
  const campaigns = useQuery(api.integrations.meta.getCampaigns, {});

  const disconnect = async () => {
    try {
      // TODO: Implement meta disconnection
      // Disconnecting Meta

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  return {
    adAccounts: adAccounts || [],
    insights: insights || [],
    campaigns: campaigns || [],
    loading:
      adAccounts === undefined ||
      insights === undefined ||
      campaigns === undefined,
    connected: !!(adAccounts && adAccounts.length > 0),
    disconnect,
  };
}

/**
 * Get Meta ad accounts
 */
export function useMetaAdAccounts() {
  const accounts = useQuery(api.integrations.meta.getAdAccounts);

  return {
    accounts: accounts || [],
    loading: accounts === undefined,
    error: null,
  };
}

/**
 * Get Meta insights
 */
export function useMetaInsights(
  accountId?: string,
  dateRange?: { start: string; end: string },
) {
  const insights = useQuery(
    api.integrations.meta.getInsights,
    accountId || dateRange ? { accountId, dateRange } : {},
  );

  return {
    insights: insights || [],
    loading: insights === undefined,
    error: null,
  };
}

/**
 * Get Meta campaigns
 */
export function useMetaCampaigns(accountId?: string) {
  const campaigns = useQuery(
    api.integrations.meta.getCampaigns,
    accountId ? { accountId } : {},
  );

  return {
    campaigns: campaigns || [],
    loading: campaigns === undefined,
    error: null,
  };
}

// ============ SYNC HOOKS ============

/**
 * Get sync monitor data
 */
export function useSyncMonitor() {
  const syncSessions = useQuery(api.web.sync.getSyncSessions, { limit: 10 });
  const syncProfile = useQuery(api.web.sync.getSyncProfile);
  const syncStats = useQuery(api.web.sync.getSyncStatistics, {});

  return {
    sessions: syncSessions || [],
    profile: syncProfile,
    stats: syncStats,
    loading:
      syncSessions === undefined ||
      syncProfile === undefined ||
      syncStats === undefined,
    nextSync: syncProfile?.nextSync,
    activityScore: syncProfile?.activityScore || 0,
  };
}

/**
 * Trigger manual sync
 */
export function useTriggerSync() {
  // Manual sync disabled: return a stable API that always rejects
  return async () => ({ success: false, error: "Manual sync disabled" });
}

/**
 * Cancel running sync
 */
export function useCancelSync() {
  const mutation = useMutation(api.web.sync.cancelSync);

  return async (sessionId: string) => {
    try {
      const result = await mutation({
        sessionId: sessionId as Id<"syncSessions">,
      });

      return { success: true, data: result };
    } catch (error) {
      // Failed to cancel sync

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel sync",
      };
    }
  };
}

// ============ CONNECTION MANAGEMENT ============

/**
 * Connect Shopify store
 */
export function useConnectShopify() {
  // TODO: Implement connectStore mutation
  // const mutation = useMutation(api.integrations.shopify.connectStore);

  return async (_accessToken: string, _scope: string, _domain: string) => {
    try {
      // const result = await mutation({ accessToken, scope, domain });
      // Connecting Shopify

      return { success: true, data: null };
    } catch (error) {
      // Failed to connect Shopify

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to connect Shopify",
      };
    }
  };
}

/**
 * Product management hooks
 */
export function useProductManagement() {
  // TODO: Implement product mutations
  // const updateProductMutation = useMutation(
  //   api.integrations.shopify.updateProduct,
  // );
  // const bulkUpdateMutation = useMutation(
  //   api.integrations.shopify.bulkUpdateProducts,
  // );

  const updateProduct = async (
    _productId: string,
    _data: Partial<{
      title: string;
      productType: string;
      vendor: string;
      tags: string[];
      status: "active" | "archived" | "draft";
    }>,
  ) => {
    try {
      // const result = await updateProductMutation({ productId, ...data });
      // Updating product

      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  const bulkUpdateProducts = async (
    _updates: Array<{
      productId: string;
      data: Partial<{
        title: string;
        productType: string;
        vendor: string;
        tags: string[];
        status: "active" | "archived" | "draft";
      }>;
    }>,
  ) => {
    try {
      // const result = await bulkUpdateMutation({ updates });
      // Bulk updating products

      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  return {
    updateProduct,
    bulkUpdateProducts,
  };
}

/**
 * Connect integration (generic)
 */
export function useConnectIntegration(platform: "shopify" | "meta") {
  return async (_code: string, _state: string) => {
    switch (platform) {
      case "shopify":
        // Shopify uses different OAuth flow through API routes
        return {
          success: false,
          error: "Shopify connection must be done through the OAuth flow",
        };
      // return await connectGoogle(code, state);
      default:
        return {
          success: false,
          error: `Unknown platform: ${platform}`,
        };
    }
  };
}

/**
 * Disconnect integration
 */
export function useDisconnectIntegration() {
  // This would need to be implemented in Convex
  return async (_platform: "shopify" | "meta") => {
    // Disconnect not yet implemented

    return {
      success: false,
      error: "Disconnect functionality not yet implemented",
    };
  };
}

// ============ PRODUCT MANAGEMENT HOOKS ============

// Removed legacy product cost stubs; see useCost.ts for actual implementations
