import { useMutation } from "convex/react";
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
  const resetMeta = useMutation(api.meyoo.admin.resetMetaData);
  const resetShopify = useMutation(api.meyoo.admin.resetShopifyData);
  const resetAll = useMutation(api.meyoo.admin.resetEverything);

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

  return {
    enabled,
    setEnabled,
    expanded,
    setExpanded,
    resetEverything,
    disconnectShopify,
    disconnectMeta,
    isLoading: loading,
    error,
    loading,
  };
}
