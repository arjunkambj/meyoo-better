import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";

import { api } from "@/libs/convexApi";

type ShopifyTimeState = {
  offsetMinutes: number | undefined;
  timezoneAbbreviation?: string;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Fetches Shopify shop time metadata (offset + abbreviation) for the current org.
 * Falls back to UTC offset 0 if unavailable.
 */
export function useShopifyTime() {
  const getShopTimeInfo = useAction(api.core.time.getShopTimeInfo);
  const [state, setState] = useState<ShopifyTimeState>({
    offsetMinutes: undefined,
    timezoneAbbreviation: undefined,
    isLoading: true,
    error: null,
  });

  const fetchInfo = useCallback(
    async (shouldAbort?: () => boolean) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        const info = await getShopTimeInfo({});
        if (shouldAbort?.()) return;

        setState({
          offsetMinutes:
            typeof info?.offsetMinutes === "number" ? info.offsetMinutes : 0,
          timezoneAbbreviation: info?.timezoneAbbreviation ?? undefined,
          isLoading: false,
          error: null,
        });
      } catch (cause) {
        if (shouldAbort?.()) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));

        setState({
          offsetMinutes: 0,
          timezoneAbbreviation: undefined,
          isLoading: false,
          error,
        });
      }
    },
    [getShopTimeInfo],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchInfo(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchInfo]);

  const refresh = useCallback(async () => {
    await fetchInfo();
  }, [fetchInfo]);

  return {
    offsetMinutes: state.offsetMinutes,
    timezoneAbbreviation: state.timezoneAbbreviation,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  } as const;
}
