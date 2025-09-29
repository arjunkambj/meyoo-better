import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect, useState } from "react";

import { api } from "@/libs/convexApi";

/**
 * Development Tools Hook
 * Provides access to dangerous dev-only operations surfaced in the dashboard
 */
export function useDevTools() {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    console.log(
      `[DevTools] Dev Tools ${enabled ? "enabled" : "disabled"} - Timestamp: ${new Date().toISOString()}`,
    );
  }, [enabled]);

  useEffect(() => {
    console.log(
      `[DevTools] Dev Tools panel ${expanded ? "expanded" : "collapsed"} - Timestamp: ${new Date().toISOString()}`,
    );
  }, [expanded]);

  const currentUser = useQuery(api.core.users.getCurrentUser);
  const resetMeta = useAction(api.meyoo.admin.resetMetaData);
  const resetShopify = useAction(api.meyoo.admin.resetShopifyData);
  const resetAll = useAction(api.meyoo.admin.resetEverything);
  const recalcAnalytics = useAction(api.meyoo.admin.recalculateAnalytics);
  const deleteMetrics = useAction(api.meyoo.admin.deleteAnalyticsMetrics);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetEverything = async () => {
    console.log(
      `[DevTools] Reset Everything triggered - Organization: ${currentUser?.organizationId} - Timestamp: ${new Date().toISOString()}`,
    );
    setLoading(true);
    setError(null);
    try {
      if (!currentUser?.organizationId) {
        throw new Error("No organization found");
      }

      const result = await resetAll({ organizationId: currentUser.organizationId });

      console.log(
        `[DevTools] Reset Everything completed - Organization: ${currentUser.organizationId} - Deleted: ${result.deleted} items, Users updated: ${result.usersUpdated} - Timestamp: ${new Date().toISOString()}`,
      );
    } catch (err) {
      const errorMsg = String(err);

      console.error(
        `[DevTools] Reset Everything failed - Organization: ${currentUser?.organizationId} - Error: ${errorMsg} - Timestamp: ${new Date().toISOString()}`,
        err,
      );
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const disconnectShopify = async () => {
    console.log(
      `[DevTools] Disconnect Shopify triggered - Organization: ${currentUser?.organizationId} - Timestamp: ${new Date().toISOString()}`,
    );
    setLoading(true);
    setError(null);
    try {
      if (!currentUser?.organizationId) {
        throw new Error("No organization found");
      }

      const result = await resetShopify({ organizationId: currentUser.organizationId });

      console.log(
        `[DevTools] Disconnect Shopify completed - Organization: ${currentUser.organizationId} - Deleted counts: ${JSON.stringify(result.deletedCounts)} - Timestamp: ${new Date().toISOString()}`,
      );
    } catch (err) {
      const errorMsg = String(err);

      console.error(
        `[DevTools] Disconnect Shopify failed - Organization: ${currentUser?.organizationId} - Error: ${errorMsg} - Timestamp: ${new Date().toISOString()}`,
        err,
      );
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const disconnectMeta = async () => {
    console.log(
      `[DevTools] Disconnect Meta triggered - Organization: ${currentUser?.organizationId} - Timestamp: ${new Date().toISOString()}`,
    );
    setLoading(true);
    setError(null);
    try {
      if (!currentUser?.organizationId) {
        throw new Error("No organization found");
      }

      const result = await resetMeta({ organizationId: currentUser.organizationId });

      console.log(
        `[DevTools] Disconnect Meta completed - Organization: ${currentUser.organizationId} - Deleted counts: ${JSON.stringify(result.deletedCounts)} - Timestamp: ${new Date().toISOString()}`,
      );
    } catch (err) {
      const errorMsg = String(err);

      console.error(
        `[DevTools] Disconnect Meta failed - Organization: ${currentUser?.organizationId} - Error: ${errorMsg} - Timestamp: ${new Date().toISOString()}`,
        err,
      );
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const recalculateAnalytics = async (daysBack: number) => {
    console.log(
      `[DevTools] Recalculate analytics triggered - Organization: ${currentUser?.organizationId} - Days back: ${daysBack} - Timestamp: ${new Date().toISOString()}`,
    );

    if (!currentUser?.organizationId) {
      throw new Error("No organization found");
    }

    const result = await recalcAnalytics({
      organizationId: currentUser.organizationId,
      daysBack,
    });

    console.log(
      `[DevTools] Recalculate analytics completed - Organization: ${currentUser.organizationId} - Processed: ${result.processed}, Updated: ${result.updated}, Skipped: ${result.skipped} - Timestamp: ${new Date().toISOString()}`,
    );

    return result;
  };

  const deleteAnalyticsMetrics = async () => {
    console.log(
      `[DevTools] Delete analytics metrics triggered - Organization: ${currentUser?.organizationId} - Timestamp: ${new Date().toISOString()}`,
    );

    if (!currentUser?.organizationId) {
      throw new Error("No organization found");
    }

    const result = await deleteMetrics({
      organizationId: currentUser.organizationId,
    });

    console.log(
      `[DevTools] Delete analytics metrics completed - Organization: ${currentUser.organizationId} - Deleted: ${result.deleted} - Tables: ${JSON.stringify(result.tables)} - Timestamp: ${new Date().toISOString()}`,
    );

    return result;
  };

  return {
    enabled,
    setEnabled,
    expanded,
    setExpanded,
    resetEverything,
    disconnectShopify,
    disconnectMeta,
    recalculateAnalytics,
    deleteAnalyticsMetrics,
    isLoading: loading,
    error,
    loading,
  };
}
