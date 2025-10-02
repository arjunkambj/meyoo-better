"use client";
import { Button, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useInvoices, useDeleteInvoice } from "@/hooks";
export default function InvoicesList() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 5;
  const {
    invoices,
    totalCount,
    loading,
    hasMore,
    loadMore,
    loadingMore,
  } = useInvoices(pageSize);
  const deleteInvoice = useDeleteInvoice();

  const handleDelete = async (invoiceId: string) => {
    setDeletingId(invoiceId);
    try {
      await deleteInvoice(invoiceId);
    } finally {
      setDeletingId(null);
    }
  };

  // Format amount for display
  const formatAmount = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "failed":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div>
      {/* Compact Header */}
      <div className="px-4 py-3 border-b border-divider">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-default-800">
            Billing History
          </h3>
          <span className="text-xs text-default-500">
            {totalCount > 0 &&
              `${totalCount}${hasMore ? "+" : ""} transaction${
                totalCount !== 1 ? "s" : ""
              }`}
          </span>
        </div>
      </div>

      {/* Compact Table Header */}
      <div className="px-4 py-2 border-b border-divider bg-content1">
        <div className="grid grid-cols-12 gap-3 text-xs font-medium text-default-500">
          <div className="col-span-3">Invoice</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Actions</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-divider">
        {loading ? (
          <div className="space-y-1.5">
            {[0, 1].map((index) => (
              <div
                key={index}
                className={`px-4 py-2.5 ${
                  index % 2 === 0
                    ? "bg-content1/40 dark:bg-content1/10"
                    : "bg-transparent dark:bg-transparent"
                }`}
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-3 space-y-1">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-3 w-32 rounded-full" />
                  </div>
                  <div className="col-span-3">
                    <Skeleton className="h-3 w-20 rounded-full" />
                  </div>
                  <div className="col-span-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                  </div>
                  <div className="col-span-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <div className="col-span-2">
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Icon
              className="mx-auto mb-2 text-default-300"
              icon="solar:document-text-linear"
              width={32}
            />
            <p className="text-xs text-default-500">No billing history yet</p>
            <p className="text-xs text-default-400 mt-0.5">
              Transactions will appear here
            </p>
          </div>
        ) : (
          invoices.map(
            (
              invoice: {
              id: string;
              invoiceNumber: string;
              description: string;
              issuedAt: number;
              amount: number;
              currency: string;
              status: string;
            },
              index,
            ) => (
              <div
                key={invoice.id}
                className={`px-4 py-2.5 transition-colors ${
                  index % 2 === 0
                    ? "bg-content1/40 dark:bg-content1/10"
                    : "bg-transparent dark:bg-transparent"
                } hover:bg-content1/60 dark:hover:bg-content1/20`}
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* Invoice ID */}
                  <div className="col-span-3">
                    <p className="text-xs font-semibold text-default-800 truncate">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-default-400 truncate">
                      {invoice.description}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="col-span-3">
                    <p className="text-xs text-default-600">
                      {new Date(invoice.issuedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-default-800">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <Chip
                      color={getStatusColor(invoice.status)}
                      size="sm"
                      startContent={
                        invoice.status === "paid" && (
                          <Icon icon="solar:check-circle-bold" width={12} />
                        )
                      }
                      variant="flat"
                      classNames={{
                        base: "h-5 px-1.5",
                        content: "text-xs px-0.5"
                      }}
                    >
                      {invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                    </Chip>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      isIconOnly
                      isLoading={deletingId === invoice.id}
                      isDisabled={deletingId === invoice.id}
                      onPress={() => handleDelete(invoice.id)}
                    >
                      <Icon icon="solar:trash-bin-trash-bold" width={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Compact Footer */}
      {hasMore && (
        <div className="px-4 py-2 border-t border-divider">
          <Button
            color="primary"
            endContent={<Icon icon="solar:arrow-down-linear" width={14} />}
            size="sm"
            variant="flat"
            className="w-full h-7 text-xs"
            isDisabled={loadingMore}
            isLoading={loadingMore}
            onPress={() => loadMore()}
          >
            {loadingMore ? "Loading" : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
