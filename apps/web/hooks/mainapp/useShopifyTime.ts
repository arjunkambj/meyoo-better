import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/libs/convexApi";

export function useShopifyTime() {
  const getInfo = useAction((api as any).core.time.getShopTimeInfo);
  const [offsetMinutes, setOffsetMinutes] = useState<number | undefined>(undefined);
  const [timezoneAbbreviation, setTimezoneAbbreviation] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const info = await getInfo({});
        if (!mounted) return;
        setOffsetMinutes(info?.offsetMinutes ?? 0);
        setTimezoneAbbreviation(info?.timezoneAbbreviation);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setOffsetMinutes(undefined);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getInfo]);

  return { offsetMinutes, timezoneAbbreviation, isLoading, error };
}
