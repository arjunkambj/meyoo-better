"use client";

import {
  addToast,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
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
import React, { useCallback, useEffect, useState } from "react";

import { OrderStatusBadge } from "@/components/shared/badges/StatusBadge";
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
  { name: "Costs", uid: "costs" },
  { name: "Shipping", uid: "shipping" },
  { name: "Profit", uid: "profit" },
  { name: "Payment", uid: "payment" },
  { name: "Ship To", uid: "location" },
];

export const OrdersTable = React.memo(function OrdersTable({
  orders,
  pagination,
  loading,
}: OrdersTableProps) {
  const [selectedKeys, setSelectedKeys] = useState<
    "all" | Set<never> | Set<string>
  >(new Set<string>());
  const [page, setPage] = useState(pagination?.page || 1);

  const { primaryCurrency } = useUser();

  useEffect(() => {
    const nextPage = pagination?.page;

    if (typeof nextPage === "number") {
      setPage(nextPage);
    }
  }, [pagination?.page]);

  // Helper functions for selection
  const isItemsSelected = useCallback(() => {
    return (
      selectedKeys === "all" ||
      (selectedKeys instanceof Set && selectedKeys.size > 0)
    );
  }, [selectedKeys]);

  const getSelectedCount = useCallback(() => {
    if (selectedKeys === "all") {
      return orders.length;
    }

    return selectedKeys instanceof Set ? selectedKeys.size : 0;
  }, [orders.length, selectedKeys]);

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
                    <Chip
                      key={tag}
                      className="h-5 text-xs"
                      color="secondary"
                      size="sm"
                      variant="flat"
                    >
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
          return <OrderStatusBadge size="sm" status={item.fulfillmentStatus} />;

        case "revenue":
          return (
            <div>
              <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
              <p className="text-xs text-default-500">{item.items} items</p>
            </div>
          );

        case "costs":
          return (
            <div>
              <p className="font-medium">{formatCurrency(item.totalCost)}</p>
              <p className="text-xs text-default-500">
                Tax: {formatCurrency(item.taxAmount)}
              </p>
            </div>
          );

        case "shipping":
          return (
            <div>
              <p className="font-medium">{formatCurrency(item.shippingCost)}</p>
            </div>
          );

        case "profit":
          return (
            <div>
              <p
                className={`font-medium ${item.profit >= 0 ? "text-success" : "text-danger"}`}
              >
                {formatCurrency(item.profit)}
              </p>
              <p className="text-xs text-default-500">
                {item.profitMargin.toFixed(1)}% margin
              </p>
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

  const selectionToolbarContent = isItemsSelected() ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">{getSelectedCount()} orders selected</span>
      <Dropdown>
        <DropdownTrigger>
          <Button
            size="sm"
            startContent={
              <Icon icon="solar:bolt-circle-bold-duotone" width={16} />
            }
            variant="flat"
          >
            Bulk Actions
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Bulk actions"
          onAction={(key) => {
            switch (key) {
              case "fulfill":
                addToast({
                  title: "Fulfilling orders",
                  description: "Selected orders are being fulfilled",
                  color: "default",
                  timeout: 3000,
                });
                break;
              case "cancel":
                addToast({
                  title: "Cancelling orders",
                  description: "Selected orders are being cancelled",
                  color: "warning",
                  timeout: 3000,
                });
                break;
              case "export":
                addToast({
                  title: "Export selected",
                  description: "Exporting selected orders...",
                  color: "default",
                  timeout: 3000,
                });
                break;
            }
            setSelectedKeys(new Set<string>());
          }}
        >
          <DropdownItem
            key="fulfill"
            startContent={<Icon icon="solar:check-circle-outline" width={16} />}
          >
            Mark as Fulfilled
          </DropdownItem>
          <DropdownItem
            key="cancel"
            className="text-danger"
            color="danger"
            startContent={<Icon icon="solar:close-circle-outline" width={16} />}
          >
            Cancel Orders
          </DropdownItem>
          <DropdownItem
            key="export"
            startContent={<Icon icon="solar:export-outline" width={16} />}
          >
            Export Selected
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
      <Button
        color="danger"
        size="sm"
        variant="flat"
        onPress={() => setSelectedKeys(new Set<string>())}
      >
        Clear Selection
      </Button>
    </div>
  ) : null;

  const paginationNode =
    !loading && pagination && orders.length > 0 ? (
      <div className="flex justify-center py-3">
        <Pagination
          showControls
          boundaries={1}
          page={page}
          siblings={1}
          size="sm"
          total={Math.max(1, Math.ceil(pagination.total / Math.max(1, pagination.pageSize)))}
          onChange={(newPage) => {
            setPage(newPage);
            pagination.setPage(newPage);
          }}
        />
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {selectionToolbarContent ? (
        <div
          className={`${DATA_TABLE_TABLE_CLASS} flex flex-wrap items-center gap-3 p-4`}
        >
          {selectionToolbarContent}
        </div>
      ) : null}
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
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          shadow="none"
          onSelectionChange={(keys) => {
            if (keys === "all") {
              setSelectedKeys("all");
            } else {
              setSelectedKeys(new Set(Array.from(keys).map(String)));
            }
          }}
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
