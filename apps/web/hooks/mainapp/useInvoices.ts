import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { api } from "@/libs/convexApi";

/**
 * Invoice Management Hook
 * Provides invoice data for billing and payment history
 */
export function useInvoices(limit: number = 10, offset: number = 0) {
  const args = useMemo(() => ({ limit, offset }), [limit, offset]);
  const result = useQuery(api.core.organizations.getInvoices, args);

  const loading = result === undefined;
  const invoices = result?.invoices || [];
  const totalCount = result?.totalCount || 0;

  return {
    invoices,
    totalCount,
    loading,
    hasMore: totalCount > offset + limit,
  };
}

