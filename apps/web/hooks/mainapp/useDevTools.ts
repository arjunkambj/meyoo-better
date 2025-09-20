import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect, useState } from "react";
import { api } from "@/libs/convexApi";
import type { GenericId as Id } from "convex/values";
// Local minimal type to avoid cross-package resolution issues during migration
export type DevToolsAction = {
  type: string;
  label: string;
  icon?: string;
  action: () => void | Promise<void>;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
};

/**
 * Development Tools Hooks
 * Provides access to debugging and monitoring features in development mode
 */

// DevTools no longer gated by NODE_ENV; controlled via UI/debug mode.

/**
 * Debug mode toggle
 */
export function useDebugMode() {
  const [debugMode, setDebugMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("debugMode") === "true";
    }

    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("debugMode", String(debugMode));
    }
  }, [debugMode]);

  const toggle = () => {
    const newState = !debugMode;

    console.log(
      `[DevTools] Debug Mode toggled - New state: ${newState ? "ON" : "OFF"} - Timestamp: ${new Date().toISOString()}`,
    );
    setDebugMode(newState);
  };

  return {
    debugMode,
    setDebugMode,
    toggle,
  };
}

/**
 * System status monitoring
 */
export function useSystemStatus() {
  const systemStats = useQuery(api.meyoo.admin.getSystemStats, {});
  const jobQueueStatus = useQuery(api.meyoo.admin.getJobQueueStatus, {});

  return {
    stats: systemStats,
    queue: jobQueueStatus,
    loading: systemStats === undefined || jobQueueStatus === undefined,
    isHealthy: jobQueueStatus?.failed === 0,
  };
}

/**
 * Sync monitoring and logs
 */
export function useSyncLogs(limit: number = 50) {
  const syncSessions = useQuery(api.web.sync.getSyncSessions, { limit });
  const syncProfile = useQuery(api.web.sync.getSyncProfile, {});

  return {
    sessions: syncSessions || [],
    profile: syncProfile,
    loading: syncSessions === undefined || syncProfile === undefined,
    activeSyncs:
      syncSessions?.filter((s) => s.status === "syncing").length || 0,
    failedSyncs: syncSessions?.filter((s) => s.status === "failed").length || 0,
  };
}

/**
 * Force sync for testing
 */
export function useForceSyncForTesting() {
  // Manual syncs are disabled. Keep API shape for dev tools but no-op.
  const forceSyncForOrg = useMutation(api.meyoo.admin.forceSyncForOrganization);

  return {
    forceCurrentUserSync: async () => ({ success: false, error: "Manual sync disabled" }),

    forceOrganizationSync: async (
      organizationId: Id<"organizations">,
      _platforms?: string[],
    ) => {
      const allPlatforms = ["shopify", "meta"];

      console.log(
        `[DevTools] Force Org Sync triggered - Organization: ${organizationId} - Platforms: ${JSON.stringify(allPlatforms)} - Timestamp: ${new Date().toISOString()}`,
      );

      try {
        const result = await forceSyncForOrg({
          organizationId,
          platforms: allPlatforms,
        });

        console.log(
          `[DevTools] Force Org Sync completed - Organization: ${organizationId} - Result: Success - Data: ${JSON.stringify(result)} - Timestamp: ${new Date().toISOString()}`,
        );

        return { success: true, data: result };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Force sync failed";

        console.error(
          `[DevTools] Force Org Sync failed - Organization: ${organizationId} - Error: ${errorMsg} - Timestamp: ${new Date().toISOString()}`,
          error,
        );

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  };
}

/**
 * Clear cache for testing
 */
export function useClearCache() {
  const clearAnalyticsCache = useMutation(api.meyoo.admin.clearAnalyticsCache);

  return async () => {
    console.log(
      `[DevTools] Clear Cache triggered - Timestamp: ${new Date().toISOString()}`,
    );

    try {
      await clearAnalyticsCache({});

      // Also clear local storage cache
      let localCacheCount = 0;

      if (typeof window !== "undefined") {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("cache_")) {
            localStorage.removeItem(key);
            localCacheCount++;
          }
        });
      }

      console.log(
        `[DevTools] Clear Cache completed - Analytics cache cleared - Local cache entries removed: ${localCacheCount} - Result: Success - Timestamp: ${new Date().toISOString()}`,
      );

      return { success: true };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to clear cache";

      console.error(
        `[DevTools] Clear Cache failed - Error: ${errorMsg} - Timestamp: ${new Date().toISOString()}`,
        error,
      );

      return {
        success: false,
        error: errorMsg,
      };
    }
  };
}

/**
 * Reset database for testing
 */
// Removed useResetDatabase hook and related reset functionality per requirements.

/**
 * DevTools actions
 */
export function useDevToolsActions(): DevToolsAction[] {
  const { forceCurrentUserSync } = useForceSyncForTesting();
  const clearCache = useClearCache();
  const { toggle: toggleDebug } = useDebugMode();

  return [
    {
      type: "cache",
      label: "Clear Cache",
      icon: "🗑️",
      action: async () => {
        console.log(
          `[DevTools] Action clicked - Clear Cache - Timestamp: ${new Date().toISOString()}`,
        );
        await clearCache();
      },
    },
    {
      type: "debug",
      label: "Toggle Debug Mode",
      icon: "🐛",
      action: () => {
        console.log(
          `[DevTools] Action clicked - Toggle Debug Mode - Timestamp: ${new Date().toISOString()}`,
        );
        toggleDebug();
      },
    },
  ];
}

/**
 * Performance monitoring
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<{
    renderTime: number;
    apiCalls: number;
    cacheHits: number;
    cacheMisses: number;
  }>({
    renderTime: 0,
    apiCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });

  useEffect(() => {
    // Monitor render performance
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();

      setMetrics((prev) => ({
        ...prev,
        renderTime: endTime - startTime,
      }));
    };
  }, []);

  return metrics;
}

/**
 * Main DevTools hook with all functionality
 */
export function useDevTools() {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Log when dev tools are enabled/disabled
  useEffect(() => {
    console.log(
      `[DevTools] Dev Tools ${enabled ? "enabled" : "disabled"} - Timestamp: ${new Date().toISOString()}`,
    );
  }, [enabled]);

  // Log when dev tools are expanded/collapsed
  useEffect(() => {
    console.log(
      `[DevTools] Dev Tools panel ${expanded ? "expanded" : "collapsed"} - Timestamp: ${new Date().toISOString()}`,
    );
  }, [expanded]);
  const currentUser = useQuery(api.core.users.getCurrentUser);
  const resetMeta = useMutation(api.meyoo.admin.resetMetaData);
  const resetShopify = useMutation(api.meyoo.admin.resetShopifyData);
  const resetAll = useMutation(api.meyoo.admin.resetEverything);
  // TODO: Create disconnectIntegration mutation in convex
  // For now, we'll handle disconnection differently
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
        const error = "No organization found";

        console.error(
          `[DevTools] Reset Everything failed - Error: ${error} - Timestamp: ${new Date().toISOString()}`,
        );
        throw new Error(error);
      }
      const result = await resetAll({
        organizationId: currentUser.organizationId,
      });

      console.log(
        `[DevTools] Reset Everything completed - Organization: ${currentUser.organizationId} - Deleted: ${result.deleted} items, Users updated: ${result.usersUpdated} - Result: Success - Timestamp: ${new Date().toISOString()}`,
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
        const error = "No organization found";

        console.error(
          `[DevTools] Disconnect Shopify failed - Error: ${error} - Timestamp: ${new Date().toISOString()}`,
        );
        throw new Error(error);
      }
      const result = await resetShopify({
        organizationId: currentUser.organizationId,
      });

      console.log(
        `[DevTools] Disconnect Shopify completed - Organization: ${currentUser.organizationId} - Deleted counts: ${JSON.stringify(result.deletedCounts)} - Result: Success - Timestamp: ${new Date().toISOString()}`,
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
        const error = "No organization found";

        console.error(
          `[DevTools] Disconnect Meta failed - Error: ${error} - Timestamp: ${new Date().toISOString()}`,
        );
        throw new Error(error);
      }
      const result = await resetMeta({
        organizationId: currentUser.organizationId,
      });

      console.log(
        `[DevTools] Disconnect Meta completed - Organization: ${currentUser.organizationId} - Deleted counts: ${JSON.stringify(result.deletedCounts)} - Result: Success - Timestamp: ${new Date().toISOString()}`,
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

/**
 * Console logger for debugging
 */
export function useDebugLogger(namespace: string) {
  const { debugMode } = useDebugMode();

  return {
    log: (...args: unknown[]) => {
      if (debugMode) {
        console.log(`[${namespace}]`, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (debugMode) {
        console.warn(`[${namespace}]`, ...args);
      }
    },
    error: (...args: unknown[]) => {
      {
        console.error(`[${namespace}]`, ...args);
      }
    },
    table: (data: unknown) => {
      if (debugMode) {
        console.table(data);
      }
    },
    time: (label: string) => {
      if (debugMode) {
        console.time(`[${namespace}] ${label}`);
      }
    },
    timeEnd: (label: string) => {
      if (debugMode) {
        console.timeEnd(`[${namespace}] ${label}`);
      }
    },
  };
}
