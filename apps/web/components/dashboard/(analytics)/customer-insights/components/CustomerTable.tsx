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
import React, { useCallback, useState } from "react";

import { CustomerStatusBadge } from "@/components/shared/badges/StatusBadge";
import { FilterBar } from "@/components/shared/filters/FilterBar";
import { useUser } from "@/hooks";
import { getSegmentStyle } from "@/libs/utils/dashboard-formatters";
import { getCurrencySymbol } from "@/libs/utils/format";

export interface Customer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
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
  };
  loading?: boolean;
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

export const CustomerTable = React.memo(function CustomerTable({
  customers,
  pagination,
  loading,
}: CustomerTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedKeys, setSelectedKeys] = useState<
    "all" | Set<never> | Set<string>
  >(new Set<string>());
  const [page, setPage] = useState(pagination?.page || 1);
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    if (key === "status") {
      setStatusFilter((value as string) || "all");
    }
  }, []);

  const filters = [
    {
      key: "status",
      label: "Status",
      type: "select" as const,
      options: [
        { value: "all", label: "All Customers" },
        { value: "converted", label: "Converted" },
        { value: "abandoned_cart", label: "Abandoned Cart" },
      ],
    },
  ];

  const filterValues = {
    status: statusFilter,
  };

  // Filter customers based on search and status
  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    if (search && search.trim() !== "") {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email.toLowerCase().includes(searchLower) ||
        customer.city?.toLowerCase().includes(searchLower) ||
        customer.country?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

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

  // Helper functions for selection
  const isItemsSelected = useCallback(() => {
    return (
      selectedKeys === "all" ||
      (selectedKeys instanceof Set && selectedKeys.size > 0)
    );
  }, [selectedKeys]);

  const getSelectedCount = useCallback(() => {
    if (selectedKeys === "all") {
      return filteredCustomers.length;
    }

    return selectedKeys instanceof Set ? selectedKeys.size : 0;
  }, [selectedKeys, filteredCustomers]);

  const renderCell = useCallback(
    (item: Customer, columnKey: React.Key) => {
      switch (columnKey) {
        case "customer":
          return (
            <div className="flex flex-col">
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-default-500">{item.email}</p>
            </div>
          );

        case "status":
          return <CustomerStatusBadge size="sm" status={item.status} />;

        case "ltv":
          return (
            <span className="font-medium text-sm">
              {currencySymbol}
              {item.lifetimeValue.toLocaleString()}
            </span>
          );

        case "orders":
          return (
            <div>
              <p className="font-medium text-sm">{item.orders}</p>
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
          const daysAgo = Math.floor(
            (Date.now() - new Date(item.lastOrderDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          return (
            <div>
              <p className="text-sm">
                {new Date(item.lastOrderDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-default-500">{daysAgo} days ago</p>
            </div>
          );
        }

        case "location":
          return (
            <p className="text-sm">
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

  return (
    <div className="space-y-4">
      <div className="pt-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Customers</h2>
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search customers, email, or location..."
            startContent={<Icon icon="solar:magnifer-linear" width={18} />}
            value={search}
            onValueChange={setSearch}
          />
          <FilterBar
            filters={filters}
            values={filterValues}
            onFilterChange={handleFilterChange}
          />
        </div>

        {isItemsSelected() && (
          <div className="flex items-center gap-4 p-3 bg-default-100 rounded-lg">
            <span className="text-sm">
              {getSelectedCount()} customers selected
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
                    case "send_email":
                      addToast({
                        title: "Bulk email",
                        description: "This feature is coming soon",
                        color: "primary",
                        timeout: 3000,
                      });
                      break;
                    case "add_tag":
                      addToast({
                        title: "Tag customers",
                        description: "This feature is coming soon",
                        color: "primary",
                        timeout: 3000,
                      });
                      break;
                    case "export":
                      addToast({
                        title: "Export selected",
                        description: "Exporting selected customers...",
                        color: "success",
                        timeout: 3000,
                      });
                      break;
                  }
                }}
              >
                <DropdownItem
                  key="send_email"
                  startContent={<Icon icon="solar:letter-linear" width={16} />}
                >
                  Send Email Campaign
                </DropdownItem>
                <DropdownItem
                  key="add_tag"
                  startContent={
                    <Icon icon="solar:tag-horizontal-linear" width={16} />
                  }
                >
                  Add Tags
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
        )}
      </div>

      <div className="relative">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton
                key={`customer-skeleton-row-${i + 1}`}
                className="h-12 w-full rounded-lg"
              />
            ))}
          </div>
        ) : (
          <>
            <Table
              removeWrapper
              aria-label="Customers table"
              className="rounded-xl border border-divider overflow-hidden"
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
                      icon="solar:users-group-two-rounded-linear"
                      width={48}
                    />
                    <p className="text-default-500">
                      {customers.length === 0
                        ? "Customer data will appear here after syncing orders from Shopify"
                        : "No customers found. Try adjusting your filters."}
                    </p>
                  </div>
                }
                items={filteredCustomers || []}
              >
                {(item: Customer) => (
                  <TableRow key={item.id}>
                    {(columnKey) => (
                      <TableCell>{renderCell(item, columnKey)}</TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {pagination && filteredCustomers.length > 0 && (
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
