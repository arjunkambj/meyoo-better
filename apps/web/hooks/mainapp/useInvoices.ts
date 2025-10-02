import { useCallback, useMemo } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";

import { api } from "@/libs/convexApi";

/**
 * Invoice Management Hook
 * Uses Convex pagination for efficient billing history fetching.
 */
export function useInvoices(pageSize: number = 10) {
  const paginationArgs = useMemo(() => ({}), []);
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.core.organizations.getInvoices,
    paginationArgs,
    {
      initialNumItems: pageSize,
    },
  );

  const loading = results.length === 0 && isLoading;
  const loadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore" || loadingMore;

  const handleLoadMore = useCallback(() => {
    if (status !== "CanLoadMore") return;

    loadMore(pageSize);
  }, [loadMore, pageSize, status]);

  return {
    invoices: results,
    totalCount: results.length,
    loading,
    hasMore,
    loadMore: handleLoadMore,
    loadingMore,
    status,
  };
}

/**
 * Hook for deleting invoices
 */
export function useDeleteInvoice() {
  const deleteInvoiceMutation = useMutation(api.core.organizations.deleteInvoice);

  const deleteInvoice = useCallback(
    async (invoiceId: string) => {
      try {
        await deleteInvoiceMutation({ invoiceId: invoiceId as any });
        return { success: true };
      } catch (error) {
        console.error("Failed to delete invoice:", error);
        return { success: false, error };
      }
    },
    [deleteInvoiceMutation]
  );

  return deleteInvoice;
}
