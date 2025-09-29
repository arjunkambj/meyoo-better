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

import { CustomerStatusBadge } from "@/components/shared/badges/StatusBadge";
import { useUser } from "@/hooks";
import { getSegmentStyle } from "@/libs/utils/dashboard-formatters";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";
import {
  DATA_TABLE_HEADER_CLASS,
  DATA_TABLE_TABLE_CLASS,
} from "@/components/shared/table/DataTableCard";

export interface Customer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate?: string | null;
  firstOrderDate?: string | null;
  segment: string;
  city?: string;
  country?: string;
}

interface CustomerTableProps {
  customers: Customer[];
  pagination?: {
    page: number;
    setPage: (page: number) => void;
    total: number;
    pageSize?: number;
    hasMore?: boolean;
  };
  loading?: boolean;
  statusFilter?: string;
}

const columns = [
  { name: "Customer", uid: "customer" },
  { name: "Status", uid: "status" },
  { name: "LTV", uid: "ltv" },
  { name: "Orders", uid: "orders" },
  { name: "Segment", uid: "segment" },
  { name: "Last Order", uid: "lastOrder" },
  { name: "Location", uid: "location" },
  { name: "Actions", uid: "actions" },
];

const dateFormatter = new Intl.DateTimeFormat("en-US");

export const CustomerTable = React.memo(function CustomerTable({
  customers,
  pagination,
  loading,
  statusFilter = "all",
}: CustomerTableProps) {
  const [page, setPage] = useState(pagination?.page || 1);
  const pageSize = pagination?.pageSize ?? 50;
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  useEffect(() => {
    const nextPage = pagination?.page;

    if (typeof nextPage === "number") {
      setPage(nextPage);
    }
  }, [pagination?.page]);

  // Filter customers based on search and status
  const filteredCustomers = customers.filter((customer) => {
    // Status filter
    if (statusFilter && statusFilter !== "all") {
      // Map the filter values to actual status values
      const statusMap: Record<string, string> = {
        converted: "converted",
        abandoned_cart: "abandoned_cart",
      };

      const mappedStatus = statusMap[statusFilter];

      if (mappedStatus && customer.status !== mappedStatus) {
        return false;
      }
    }

    return true;
  });

  const renderCell = useCallback(
    (item: Customer, columnKey: React.Key) => {
      switch (columnKey) {
        case "customer":
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-default-900">
                {item.name}
              </p>
              <p className="truncate text-xs text-default-500">{item.email}</p>
            </div>
          );

        case "status":
          return <CustomerStatusBadge size="sm" status={item.status} />;

        case "ltv":
          return (
            <span className="text-sm font-semibold text-default-900">
              {currencySymbol}
              {formatNumber(item.lifetimeValue)}
            </span>
          );

        case "orders":
          return (
            <div>
              <p className="text-sm font-medium text-default-900">
                {item.orders}
              </p>
              <p className="text-xs text-default-500">
                AOV: {currencySymbol}
                {item.avgOrderValue.toFixed(0)}
              </p>
            </div>
          );

        case "segment":
          return (
            <Chip
              className={getSegmentStyle(item.segment)}
              size="sm"
              variant="flat"
            >
              {item.segment}
            </Chip>
          );

        case "lastOrder": {
          const rawDate = item.lastOrderDate;
          const parsedDate = rawDate ? new Date(rawDate) : undefined;
          const isValidDate =
            parsedDate !== undefined && !Number.isNaN(parsedDate.getTime());

          if (!isValidDate) {
            return (
              <div>
                <p className="text-sm text-default-500">No orders yet</p>
                <p className="text-xs text-default-400">—</p>
              </div>
            );
          }

          const daysAgo = Math.max(
            0,
            Math.floor(
              (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          );

          return (
            <div>
              <p className="text-sm font-medium text-default-900">
                {dateFormatter.format(parsedDate)}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-default-500">
                <Icon icon="solar:clock-circle-linear" width={14} />
                {daysAgo} days ago
              </p>
            </div>
          );
        }

        case "location":
          return (
            <p className="text-sm text-default-700">
              {item.city ? `${item.city}, ` : ""}
              {item.country || "Unknown"}
            </p>
          );

        case "actions":
          return (
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light">
                  <Icon icon="solar:menu-dots-bold" width={20} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Customer actions">
                <DropdownItem
                  key="view"
                  startContent={<Icon icon="solar:eye-linear" width={16} />}
                  onClick={() => {
                    addToast({
                      title: "Customer profile coming soon",
                      description:
                        "Detailed customer view will be available soon",
                      color: "primary",
                      timeout: 3000,
                    });
                  }}
                >
                  View Profile
                </DropdownItem>
                <DropdownItem
                  key="email"
                  startContent={<Icon icon="solar:letter-linear" width={16} />}
                  onClick={() => {
                    addToast({
                      title: "Email feature coming soon",
                      description:
                        "Customer email campaigns will be available soon",
                      color: "primary",
                      timeout: 3000,
                    });
                  }}
                >
                  Send Email
                </DropdownItem>
                <DropdownItem
                  key="export"
                  startContent={<Icon icon="solar:export-linear" width={16} />}
                  onClick={() => {
                    addToast({
                      title: "Export feature coming soon",
                      description:
                        "Customer data export will be available soon",
                      color: "primary",
                      timeout: 3000,
                    });
                  }}
                >
                  Export Data
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          );

        default:
          return null;
      }
    },
    [currencySymbol]
  );

  const totalPages = pagination
    ? Math.max(page, Math.ceil((pagination.total || 0) / pageSize) || 1)
    : 1;

  const paginationNode =
    !loading && pagination && filteredCustomers.length > 0 ? (
      <div className="flex justify-center py-3">
        <Pagination
          showControls
          boundaries={1}
          page={page}
          siblings={1}
          size="sm"
          total={totalPages}
          onChange={(newPage) => {
            setPage(newPage);
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
                key={`customers-loading-${index}`}
                className="h-8 w-full rounded-lg"
              />
            ))}
          </div>
        </div>
      ) : (
        <Table
          removeWrapper
          aria-label="Customers table"
          className={DATA_TABLE_TABLE_CLASS}
          classNames={{
            th: DATA_TABLE_HEADER_CLASS,
            td: "py-2.5 px-3 text-sm text-default-800",
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
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <div className="py-10 text-center">
                    <Icon
                      className="mx-auto mb-4 text-default-300"
                      icon="solar:users-group-two-rounded-linear"
                      width={48}
                    />
                    <p className="text-default-500">
                      {customers.length === 0
                        ? "Customer data will appear here after syncing orders from Shopify"
                        : "No customers found. Try adjusting your filters."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((item, index) => {
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
