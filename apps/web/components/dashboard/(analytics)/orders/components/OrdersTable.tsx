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

export interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
  };
  status: string;
  fulfillmentStatus: string;
  financialStatus: string;
  items: number;
  totalPrice: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  taxAmount: number;
  shippingCost: number;
  paymentMethod: string;
  tags?: string[];
  shippingAddress: {
    city: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  lineItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    cost: number;
  }>;
}

interface OrdersTableProps {
  orders: Order[];
  pagination?: {
    page: number;
    setPage: (page: number) => void;
    total: number;
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
    (item: Order, columnKey: React.Key) => {
      const formatCurrency = (value: number) =>
        formatCurrencyPrecise(value, primaryCurrency);

      switch (columnKey) {
        case "order":
          return (
            <div>
              <p className="font-medium text-sm">#{item.orderNumber}</p>
              <p className="text-xs text-default-500">
                {formatDate(item.createdAt)}
              </p>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.tags.map((tag) => (
                    <Chip
                      key={tag}
                      className="text-xs h-5"
                      color="secondary"
                      size="sm"
                      variant="flat"
                    >
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          );

        case "customer":
          return (
            <div>
              <p className="font-medium text-sm">{item.customer.name}</p>
              <p className="text-xs text-default-500">{item.customer.email}</p>
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

  return (
    <section className="flex flex-col gap-4">
      {isItemsSelected() && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-divider bg-content2 px-4 py-3">
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
                      color: "success",
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
                      color: "success",
                      timeout: 3000,
                    });
                    break;
                }
                setSelectedKeys(new Set<string>());
              }}
            >
              <DropdownItem
                key="fulfill"
                startContent={
                  <Icon icon="solar:check-circle-outline" width={16} />
                }
              >
                Mark as Fulfilled
              </DropdownItem>
              <DropdownItem
                key="cancel"
                className="text-danger"
                color="danger"
                startContent={
                  <Icon icon="solar:close-circle-outline" width={16} />
                }
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
            onPress={() => setSelectedKeys(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-divider bg-content2 p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton
                key={`orders-table-skeleton-${i + 1}`}
                className="h-12 w-full rounded-lg"
              />
            ))}
          </div>
        ) : (
          <>
            <Table
              removeWrapper
              aria-label="Orders table"
              className="rounded-xl border border-divider bg-default-50 overflow-hidden"
              classNames={{
                th: "bg-default-100 text-default-600 font-medium",
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
              <TableBody
                emptyContent={
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
                }
                items={orders || []}
              >
                {(item: Order) => (
                  <TableRow key={item.id}>
                    {(columnKey) => (
                      <TableCell>{renderCell(item, columnKey)}</TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {pagination && orders.length > 0 && (
              <div className="flex justify-center pt-2">
                <Pagination
                  showControls
                  boundaries={1}
                  page={page}
                  siblings={1}
                  size="sm"
                  total={Math.ceil(pagination.total / 50)}
                  onChange={(newPage) => {
                    setPage(newPage);
                    pagination.setPage(newPage);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
});
