"use client";

import { useEffect, useState } from "react";

/**
 * useMediaQuery
 * Client-only hook that returns true when the provided CSS media query matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);

    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setMatches("matches" in e ? e.matches : (e as MediaQueryList).matches);
    };

    // Initialize and subscribe
    setMatches(mql.matches);
    // Modern browsers
    if (typeof (mql as any).addEventListener === "function") {
      (mql as any).addEventListener("change", onChange as (e: MediaQueryListEvent) => void);
      return () => (mql as any).removeEventListener("change", onChange as (e: MediaQueryListEvent) => void);
    }
    // Legacy API fallback (older Safari/Firefox)
    const legacy = mql as MediaQueryList & {
      addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any) => void;
      removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any) => void;
    };
    legacy.addListener?.(onChange as any);
    return () => legacy.removeListener?.(onChange as any);
  }, [query]);

  return matches;
}
