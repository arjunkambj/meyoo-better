"use client";

import { Chip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type React from "react";

export type StatusType =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "default"
  | "primary"
  | "secondary";

export interface StatusConfig {
  label: string;
  type: StatusType;
  icon?: string;
}

// Predefined status configurations for common use cases
export const ORDER_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    type: "warning",
    icon: "solar:clock-circle-linear",
  },
  processing: {
    label: "Processing",
    type: "info",
    icon: "solar:refresh-linear",
  },
  paid: { label: "Paid", type: "success", icon: "solar:check-circle-linear" },
  fulfilled: { label: "Fulfilled", type: "success", icon: "solar:box-linear" },
  shipped: { label: "Shipped", type: "primary", icon: "solar:delivery-linear" },
  delivered: {
    label: "Delivered",
    type: "success",
    icon: "solar:check-read-linear",
  },
  cancelled: {
    label: "Cancelled",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
  refunded: {
    label: "Refunded",
    type: "warning",
    icon: "solar:restart-linear",
  },
  failed: {
    label: "Failed",
    type: "danger",
    icon: "solar:danger-triangle-linear",
  },
};

export const PAYMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: "Pending",
    type: "warning",
    icon: "solar:clock-circle-linear",
  },
  authorized: {
    label: "Authorized",
    type: "info",
    icon: "solar:shield-check-linear",
  },
  partially_paid: {
    label: "Partially Paid",
    type: "warning",
    icon: "solar:wallet-linear",
  },
  paid: { label: "Paid", type: "success", icon: "solar:check-circle-linear" },
  partially_refunded: {
    label: "Partially Refunded",
    type: "warning",
    icon: "solar:refresh-square-linear",
  },
  refunded: {
    label: "Refunded",
    type: "default",
    icon: "solar:restart-linear",
  },
  voided: {
    label: "Voided",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
};

export const FULFILLMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  unfulfilled: {
    label: "Unfulfilled",
    type: "default",
    icon: "solar:inbox-linear",
  },
  pending: {
    label: "Pending",
    type: "warning",
    icon: "solar:clock-circle-linear",
  },
  scheduled: {
    label: "Scheduled",
    type: "info",
    icon: "solar:calendar-linear",
  },
  on_hold: {
    label: "On Hold",
    type: "warning",
    icon: "solar:pause-circle-linear",
  },
  partial: {
    label: "Partial",
    type: "warning",
    icon: "solar:archive-minimalistic-linear",
  },
  partially_fulfilled: {
    label: "Partially Fulfilled",
    type: "warning",
    icon: "solar:archive-minimalistic-linear",
  },
  fulfilled: { label: "Fulfilled", type: "success", icon: "solar:box-linear" },
  shipped: { label: "Shipped", type: "primary", icon: "solar:delivery-linear" },
  in_transit: {
    label: "In Transit",
    type: "primary",
    icon: "solar:delivery-linear",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    type: "primary",
    icon: "solar:delivery-linear",
  },
  ready_for_pickup: {
    label: "Ready for Pickup",
    type: "info",
    icon: "solar:bag-check-linear",
  },
  label_printed: {
    label: "Label Printed",
    type: "info",
    icon: "solar:document-text-linear",
  },
  label_purchased: {
    label: "Label Purchased",
    type: "info",
    icon: "solar:wallet-linear",
  },
  attempted_delivery: {
    label: "Attempted Delivery",
    type: "warning",
    icon: "solar:map-point-wave-linear",
  },
  delivered: {
    label: "Delivered",
    type: "success",
    icon: "solar:check-read-linear",
  },
  not_delivered: {
    label: "Not Delivered",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
  returned: {
    label: "Returned",
    type: "warning",
    icon: "solar:undo-left-linear",
  },
  canceled: {
    label: "Canceled",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
  cancelled: {
    label: "Cancelled",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
};

export const STOCK_STATUS_CONFIG: Record<string, StatusConfig> = {
  in_stock: {
    label: "In Stock",
    type: "success",
    icon: "solar:check-circle-linear",
  },
  low_stock: {
    label: "Low Stock",
    type: "warning",
    icon: "solar:danger-triangle-linear",
  },
  out_of_stock: {
    label: "Out of Stock",
    type: "danger",
    icon: "solar:close-circle-linear",
  },
  overstock: {
    label: "Overstock",
    type: "info",
    icon: "solar:add-circle-linear",
  },
  discontinued: {
    label: "Discontinued",
    type: "default",
    icon: "solar:archive-linear",
  },
};

export const PRODUCT_STATUS_CONFIG: Record<string, StatusConfig> = {
  active: {
    label: "Active",
    type: "success",
    icon: "solar:check-circle-linear",
  },
  draft: { label: "Draft", type: "default", icon: "solar:pen-linear" },
  archived: {
    label: "Archived",
    type: "default",
    icon: "solar:archive-linear",
  },
};

export const CUSTOMER_STATUS_CONFIG: Record<string, StatusConfig> = {
  converted: {
    label: "Converted",
    type: "success",
    icon: "solar:bag-check-linear",
  },
  abandoned_cart: {
    label: "Abandoned Cart",
    type: "danger",
    icon: "solar:cart-cross-linear",
  },
};

export interface StatusBadgeProps {
  status: string;
  config?: Record<string, StatusConfig>;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "flat" | "dot" | "bordered";
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  config,
  size = "sm",
  variant = "flat",
  showIcon = true,
  className,
}: StatusBadgeProps) {
  // Normalize status to lowercase for consistent matching
  const normalizedStatus = status.toLowerCase().replace(/[^a-z0-9]/g, "_");

  // Try to find config from provided config or default configs
  let statusConfig: StatusConfig | undefined = config?.[normalizedStatus];

  // If not found in provided config, check default configs
  if (!statusConfig) {
    statusConfig =
      ORDER_STATUS_CONFIG[normalizedStatus] ||
      PAYMENT_STATUS_CONFIG[normalizedStatus] ||
      FULFILLMENT_STATUS_CONFIG[normalizedStatus] ||
      STOCK_STATUS_CONFIG[normalizedStatus] ||
      PRODUCT_STATUS_CONFIG[normalizedStatus] ||
      CUSTOMER_STATUS_CONFIG[normalizedStatus];
  }

  // Fallback to a generic config if status is not recognized
  if (!statusConfig) {
    statusConfig = {
      label:
        status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
      type: "default",
    };
  }

  const getColor = (type: StatusType) => {
    switch (type) {
      case "success":
        return "success";
      case "warning":
        return "warning";
      case "danger":
        return "danger";
      case "info":
      case "primary":
        return "primary";
      case "secondary":
        return "secondary";
      default:
        return "default";
    }
  };

  return (
    <Chip
      className={cn("capitalize", className)}
      color={getColor(statusConfig.type)}
      size={size}
      startContent={
        showIcon &&
        statusConfig.icon && (
          <Icon
            className={cn(
              size === "sm" && "w-3 h-3",
              size === "md" && "w-4 h-4",
              size === "lg" && "w-5 h-5"
            )}
            icon={statusConfig.icon}
          />
        )
      }
      variant={variant}
    >
      {statusConfig.label}
    </Chip>
  );
}

// Export a compound component for easy access to specific status types
export const OrderStatusBadge: React.FC<Omit<StatusBadgeProps, "config">> = (
  props
) => <StatusBadge {...props} config={ORDER_STATUS_CONFIG} />;

export const PaymentStatusBadge: React.FC<Omit<StatusBadgeProps, "config">> = (
  props
) => <StatusBadge {...props} config={PAYMENT_STATUS_CONFIG} />;

export const FulfillmentStatusBadge: React.FC<
  Omit<StatusBadgeProps, "config">
> = (props) => <StatusBadge {...props} config={FULFILLMENT_STATUS_CONFIG} />;

export const StockStatusBadge: React.FC<Omit<StatusBadgeProps, "config">> = (
  props
) => <StatusBadge {...props} config={STOCK_STATUS_CONFIG} />;

export const ProductStatusBadge: React.FC<Omit<StatusBadgeProps, "config">> = (
  props
) => <StatusBadge {...props} config={PRODUCT_STATUS_CONFIG} />;

export const CustomerStatusBadge: React.FC<Omit<StatusBadgeProps, "config">> = (
  props
) => <StatusBadge {...props} config={CUSTOMER_STATUS_CONFIG} />;
