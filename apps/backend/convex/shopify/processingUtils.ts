
import type { Doc } from "../_generated/dataModel";

export const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (typeof value === "number") return String(value);

  return undefined;
};

const ORDER_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyOrders">> = [
  "orderNumber",
  "name",
  "customerId",
  "email",
  "phone",
  "shopifyCreatedAt",
  "updatedAt",
  "processedAt",
  "closedAt",
  "cancelledAt",
  "financialStatus",
  "fulfillmentStatus",
  "totalPrice",
  "subtotalPrice",
  "totalDiscounts",
  "totalTip",
  "currency",
  "totalItems",
  "totalQuantity",
  "totalWeight",
  "tags",
  "note",
  "shippingAddress",
];

const LINE_ITEM_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyOrderItems">> = [
  "shopifyProductId",
  "shopifyVariantId",
  "productId",
  "variantId",
  "title",
  "variantTitle",
  "sku",
  "quantity",
  "price",
  "totalDiscount",
  "fulfillableQuantity",
  "fulfillmentStatus",
];

const TRANSACTION_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyTransactions">> = [
  "orderId",
  "shopifyOrderId",
  "kind",
  "status",
  "gateway",
  "amount",
  "fee",
  "paymentId",
  "shopifyCreatedAt",
  "processedAt",
];

const REFUND_COMPARE_FIELDS: ReadonlyArray<keyof Doc<"shopifyRefunds">> = [
  "orderId",
  "shopifyOrderId",
  "note",
  "userId",
  "totalRefunded",
  "refundLineItems",
  "shopifyCreatedAt",
  "processedAt",
];

const CUSTOMER_WEBHOOK_COMPARE_FIELDS: ReadonlyArray<
  keyof Doc<"shopifyCustomers">
> = ["email", "phone", "firstName", "lastName"];

export const valuesMatch = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }

  if (a && typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b ?? null);
  }

  if (b && typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b);
  }

  return a === b;
};

export const hasOrderMeaningfulChange = (
  existing: Doc<"shopifyOrders">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of ORDER_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

export const hasOrderItemMeaningfulChange = (
  existing: Doc<"shopifyOrderItems">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of LINE_ITEM_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

export const hasTransactionMeaningfulChange = (
  existing: Doc<"shopifyTransactions">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of TRANSACTION_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

export const hasRefundMeaningfulChange = (
  existing: Doc<"shopifyRefunds">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of REFUND_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};

export const hasCustomerWebhookChange = (
  existing: Doc<"shopifyCustomers">,
  candidate: Record<string, unknown>,
): boolean => {
  for (const field of CUSTOMER_WEBHOOK_COMPARE_FIELDS) {
    if (
      !valuesMatch(
        (existing as Record<string, unknown>)[field as string],
        candidate[field as string],
      )
    ) {
      return true;
    }
  }

  return false;
};
