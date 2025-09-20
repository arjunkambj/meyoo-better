"use client";
import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { useInvoices } from "@/hooks";

export default function InvoicesList() {
  const [offset, setOffset] = useState(0);
  const limit = 5;
  const { invoices, totalCount, loading, hasMore } = useInvoices(limit, offset);

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
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
      {/* Header */}
      <div className="px-6 py-4 border-b border-divider">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Billing History
          </h3>
        </div>
      </div>

      {/* Table Header */}
      <div className="px-6 py-3 border-b border-divider">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium text-default-500 uppercase">
          <div className="col-span-3">Transaction ID</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right"></div>
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-divider">
        {loading ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-default-500">
              Loading billing history...
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Icon
              className="mx-auto mb-3 text-default-300"
              icon="solar:document-text-linear"
              width={48}
            />
            <p className="text-sm text-default-500">No billing history yet</p>
            <p className="text-xs text-default-400 mt-1">
              Your billing transactions will appear here once generated
            </p>
          </div>
        ) : (
          invoices.map(
            (invoice: {
              id: string;
              invoiceNumber: string;
              description: string;
              issuedAt: number;
              amount: number;
              currency: string;
              status: string;
            }) => (
              <div
                key={invoice.id}
                className="px-6 py-4 hover:bg-content2 transition-colors"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Invoice ID */}
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-foreground">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-default-500 mt-0.5">
                      {invoice.description}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="col-span-3">
                    <p className="text-sm text-default-600">
                      {formatDate(invoice.issuedAt)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-foreground">
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
                          <Icon icon="solar:check-circle-bold" width={14} />
                        )
                      }
                      variant="flat"
                    >
                      {invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                    </Chip>
                  </div>

                  {/* Empty Actions column */}
                  <div className="col-span-2"></div>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-divider">
        <div className="flex items-center justify-between">
          <p className="text-sm text-default-500">
            {invoices.length > 0
              ? `Showing ${Math.min(invoices.length, limit)} of ${totalCount} transaction${totalCount !== 1 ? "s" : ""}`
              : "No transactions to display"}
          </p>
          {hasMore && (
            <Button
              color="primary"
              endContent={<Icon icon="solar:arrow-right-linear" width={16} />}
              size="sm"
              variant="flat"
              onPress={() => setOffset(offset + limit)}
            >
              Load More
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
