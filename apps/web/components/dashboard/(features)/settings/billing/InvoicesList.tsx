"use client";
import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useInvoices } from "@/hooks";
export default function InvoicesList() {
  const [offset, setOffset] = useState(0);
  const limit = 5;
  const { invoices, totalCount, loading, hasMore } = useInvoices(limit, offset);

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
            {totalCount > 0 && `${totalCount} transaction${totalCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* Compact Table Header */}
      <div className="px-4 py-2 border-b border-divider bg-content1">
        <div className="grid grid-cols-12 gap-3 text-xs font-medium text-default-500">
          <div className="col-span-4">Invoice</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-3">Status</div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-divider">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-default-500">
              Loading billing history...
            </p>
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
                  <div className="col-span-4">
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
                  <div className="col-span-3">
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
            onPress={() => setOffset(offset + limit)}
          >
            Load More ({totalCount - invoices.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
