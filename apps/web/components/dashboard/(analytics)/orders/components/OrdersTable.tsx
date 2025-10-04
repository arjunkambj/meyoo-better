"use client";

import {
  Chip,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React, { useCallback } from "react";

import { FulfillmentStatusBadge } from "@/components/shared/badges/StatusBadge";
import { useUser } from "@/hooks";
import { formatCurrencyPrecise } from "@/libs/utils/dashboard-formatters";
import { formatDate } from "@/libs/utils/format";
import {
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";
import type { AnalyticsOrder } from "@repo/types";

interface OrdersTableProps {
  orders: AnalyticsOrder[];
  pagination?: {
    page: number;
    setPage: (page: number) => void;
    total: number;
    pageSize: number;
  };
  loading?: boolean;
}

const columns = [
  { name: "Order", uid: "order" },
  { name: "Customer", uid: "customer" },
  { name: "Fulfillment", uid: "status" },
  { name: "Revenue", uid: "revenue" },
  { name: "Payment", uid: "payment" },
  { name: "Ship To", uid: "location" },
];

export const OrdersTable = React.memo(function OrdersTable({
  orders,
  pagination,
  loading,
}: OrdersTableProps) {
  const { primaryCurrency } = useUser();

  const renderCell = useCallback(
    (item: AnalyticsOrder, columnKey: React.Key) => {
      const formatCurrency = (value: number) =>
        formatCurrencyPrecise(value, primaryCurrency);

      switch (columnKey) {
        case "order":
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-default-900">
                #{item.orderNumber}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-default-500">
                <Icon icon="solar:calendar-linear" width={14} />
                {formatDate(item.createdAt)}
              </p>
              {item.tags && item.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Chip key={tag} color="default" size="sm">
                      {tag}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
          );

        case "customer":
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-default-900">
                {item.customer.name}
              </p>
              <p className="truncate text-xs text-default-500">
                {item.customer.email}
              </p>
            </div>
          );

        case "status":
          return (
            <FulfillmentStatusBadge
              size="sm"
              status={item.fulfillmentStatus || "unfulfilled"}
              variant="solid"
            />
          );

        case "revenue":
          return (
            <div>
              <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
              <p className="text-xs text-default-500">{item.items} items</p>
            </div>
          );

        case "payment":
          return (
            <Chip
              color={
                item.financialStatus === "paid"
                  ? "success"
                  : item.financialStatus === "pending"
                    ? "warning"
                    : "default"
              }
              size="sm"
              variant="flat"
            >
              {item.financialStatus === "paid"
                ? "Paid"
                : item.financialStatus === "pending"
                  ? "COD"
                  : item.financialStatus}
            </Chip>
          );

        case "location":
          return (
            <div className="text-sm">
              <p>{item.shippingAddress.city}</p>
              <p className="text-xs text-default-500">
                {item.shippingAddress.country}
              </p>
            </div>
          );

        default:
          return null;
      }
    },
    [primaryCurrency]
  );

  const paginationNode =
    !loading && pagination && orders.length > 0 ? (
      <div className="flex justify-center py-3">
        <Pagination
          showControls
          boundaries={1}
          page={pagination.page}
          siblings={1}
          size="sm"
          total={Math.max(
            1,
            Math.ceil(pagination.total / Math.max(1, pagination.pageSize))
          )}
          onChange={(newPage) => {
            pagination.setPage(newPage);
          }}
        />
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className={DATA_TABLE_TABLE_CLASS}>
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={`orders-loading-${index}`}
                className="h-8 w-full rounded-lg"
              />
            ))}
          </div>
        </div>
      ) : (
        <Table
          removeWrapper
          aria-label="Orders table"
          className={DATA_TABLE_TABLE_CLASS}
          classNames={{
            th: DATA_TABLE_HEADER_CLASS,
            td: "py-2.5 px-3 text-sm text-default-800 align-middle",
            table: "text-xs",
          }}
          shadow="none"
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.uid}>{column.name}</TableColumn>
            )}
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="py-10 text-center">
                    <Icon
                      className="mx-auto mb-4 text-default-300"
                      icon="solar:cart-large-minimalistic-outline"
                      width={48}
                    />
                    <p className="text-default-500">
                      No orders found. Orders will sync from Shopify.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((item, index) => {
                const stripe = index % 2 === 1;

                return (
                  <TableRow
                    key={item.id}
                    className={`${stripe ? "bg-default-50 dark:bg-content1/50" : "bg-background"} border-t border-default-border`}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.uid}>
                        {renderCell(item, column.uid)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
      {paginationNode}
    </div>
  );
});
