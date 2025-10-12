import { useMemo } from "react";
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
  const overview = useQuery(api.integrations.overview.getOverview);
  const loading = overview === undefined;

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
      connected: Boolean(overview?.shopify.connected),
      store: overview?.shopify.store ?? null,
      loading,
    },
    meta: {
      connected: Boolean(overview?.meta.connected),
      accounts: overview?.meta.accounts ?? [],
      primaryAccountId: overview?.meta.primaryAccountId ?? null,
      activeAccountCount: overview?.meta.activeAccountCount ?? 0,
      loading,
      disconnect: disconnectMeta,
    },
    google: {
      connected: Boolean(overview?.google.connected),
      accounts: [],
      loading,
      comingSoon: Boolean(overview?.google.comingSoon ?? true),
      disconnect: async () => ({
        success: false,
        error: "Google Ads integration is currently unavailable.",
      }),
    },
    loading,
    hasAnyIntegration: Boolean(overview?.hasAnyIntegration),
    connectedIntegrations: overview?.connectedIntegrations ?? [],
    disconnectedIntegrations: overview?.disconnectedIntegrations ?? [],
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
  const args = useMemo(
    () => ({ page, pageSize, searchTerm }),
    [page, pageSize, searchTerm],
  );

  const result = useQuery(
    api.integrations.shopify.getProductVariantsPaginated,
    args,
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
