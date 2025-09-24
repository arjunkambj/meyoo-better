import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/libs/convexApi";

type ShopifyTimeInfo = {
  offsetMinutes: number;
  timezoneAbbreviation?: string;
};

let cachedShopTimeInfo: ShopifyTimeInfo | null = null;

export function useShopifyTime() {
  const getInfo = useAction((api as any).core.time.getShopTimeInfo);
  const [offsetMinutes, setOffsetMinutes] = useState<number | undefined>(() =>
    cachedShopTimeInfo?.offsetMinutes
  );
  const [timezoneAbbreviation, setTimezoneAbbreviation] = useState<
    string | undefined
  >(() => cachedShopTimeInfo?.timezoneAbbreviation);
  const [isLoading, setIsLoading] = useState(() => cachedShopTimeInfo === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInfo = async () => {
      if (cachedShopTimeInfo === null) {
        setIsLoading(true);
      }

      try {
        const info = await getInfo({});
        if (!mounted) return;

        const nextOffset =
          info?.offsetMinutes ?? cachedShopTimeInfo?.offsetMinutes ?? 0;
        const nextTimezone = info?.timezoneAbbreviation;

        cachedShopTimeInfo = {
          offsetMinutes: nextOffset,
          timezoneAbbreviation: nextTimezone,
        };

        setOffsetMinutes(nextOffset);
        setTimezoneAbbreviation(nextTimezone);
        setError(null);
      } catch (e) {
        if (!mounted) return;

        setError(e instanceof Error ? e.message : String(e));
        if (cachedShopTimeInfo === null) {
          setOffsetMinutes(undefined);
          setTimezoneAbbreviation(undefined);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInfo();

    return () => {
      mounted = false;
    };
  }, [getInfo]);

  return { offsetMinutes, timezoneAbbreviation, isLoading, error };
}
