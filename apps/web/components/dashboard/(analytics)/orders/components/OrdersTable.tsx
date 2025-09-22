"use client";

import {
  addToast,
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
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
import React, { useCallback, useEffect, useMemo, useState } from "react";

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
  searchValue?: string;
  onSearchSubmit?: (term: string) => void;
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
  searchValue,
  onSearchSubmit,
}: OrdersTableProps) {
  const [search, setSearch] = useState(searchValue ?? "");
  const [selectedKeys, setSelectedKeys] = useState<
    "all" | Set<never> | Set<string>
  >(new Set<string>());
  const [page, setPage] = useState(pagination?.page || 1);

  const { primaryCurrency } = useUser();

  useEffect(() => {
    setSearch(searchValue ?? "");
  }, [searchValue]);

  useEffect(() => {
    const nextPage = pagination?.page;

    if (typeof nextPage === "number") {
      setPage(nextPage);
    }
  }, [pagination?.page]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    if (!normalizedSearch) return orders;

    return orders.filter((order) => {
      return (
        order.orderNumber.toLowerCase().includes(normalizedSearch) ||
        order.customer.name.toLowerCase().includes(normalizedSearch) ||
        order.customer.email.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [orders, normalizedSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (!onSearchSubmit) return;

    const next = search.trim();
    const previous = (searchValue ?? "").trim();

    if (next === previous) return;

    onSearchSubmit(next);
  }, [onSearchSubmit, search, searchValue]);

  const handleSearchClear = useCallback(() => {
    setSearch("");

    if (onSearchSubmit && (searchValue ?? "").trim() !== "") {
      onSearchSubmit("");
    }
  }, [onSearchSubmit, searchValue]);

  // Helper functions for selection
  const isItemsSelected = useCallback(() => {
    return (
      selectedKeys === "all" ||
      (selectedKeys instanceof Set && selectedKeys.size > 0)
    );
  }, [selectedKeys]);

  const getSelectedCount = useCallback(() => {
    if (selectedKeys === "all") {
      return filteredOrders.length;
    }

    return selectedKeys instanceof Set ? selectedKeys.size : 0;
  }, [selectedKeys, filteredOrders]);

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
    <div className="space-y-4">
      <div className="px-2 pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Orders</h2>
          <Button
            color="primary"
            startContent={<Icon icon="solar:add-outline" width={16} />}
            onPress={() => {
              addToast({
                title: "Create order",
                description: "Manual order creation coming soon",
                color: "primary",
                timeout: 3000,
              });
            }}
          >
            Create Order
          </Button>
        </div>

        <Input
          isClearable
          className="max-w-xs"
          placeholder="Search orders by ID, customer, or email..."
          startContent={<Icon icon="solar:search-outline" width={18} />}
          value={search}
          onBlur={handleSearchSubmit}
          onClear={handleSearchClear}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearchSubmit();
            }
          }}
          onValueChange={setSearch}
        />

        {isItemsSelected() && (
          <div className="flex items-center gap-4 p-3 bg-default-100 rounded-lg">
            <span className="text-sm">
              {getSelectedCount()} orders selected
            </span>
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
      </div>

      <div className="px-2 relative">
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
                  <div className="text-center py-10">
                    <Icon
                      className="mx-auto text-default-300 mb-4"
                      icon="solar:cart-large-minimalistic-outline"
                      width={48}
                    />
                    <p className="text-default-500">
                      No orders found. Orders will sync from Shopify.
                    </p>
                  </div>
                }
                items={filteredOrders || []}
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

            {pagination && filteredOrders.length > 0 && (
              <div className="flex justify-center py-4">
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
    </div>
  );
});
