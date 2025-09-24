import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

/**
 * Integration Management Hooks
 * Handles Shopify, Meta, and Google integrations
 */

/**
 * Get integration status for all platforms
 */
export function useIntegration() {
  const shopifyStore = useQuery(api.integrations.shopify.getStore);
  const metaAccounts = useQuery(api.integrations.meta.getAdAccounts);

  const loading = shopifyStore === undefined || metaAccounts === undefined;

  const disconnectMeta = async () => {
    try {
      // TODO: Implement meta disconnection
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
