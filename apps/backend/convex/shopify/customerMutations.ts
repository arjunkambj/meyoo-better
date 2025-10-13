
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { logger, BULK_OPS, chunkArray } from "./shared";
import { toMs } from "../utils/shopify";
import { toOptionalString } from "./processingUtils";

type CustomerAddress = {
  country?: string;
  province?: string;
  city?: string;
  zip?: string;
};

type NormalizedCustomer = {
  organizationId: Id<"organizations">;
  storeId: Id<"shopifyStores">;
  shopifyId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  ordersCount: number;
  totalSpent: number;
  state?: string;
  verifiedEmail?: boolean;
  taxExempt?: boolean;
  defaultAddress?: CustomerAddress;
  tags?: string[];
  note?: string;
  shopifyCreatedAt: number;
  shopifyUpdatedAt: number;
  syncedAt: number;
};

const normalizeCustomerAddress = (value: unknown): CustomerAddress | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const maybeAddress = value as Record<string, unknown>;
  const address: CustomerAddress = {
    country: toOptionalString(maybeAddress.country),
    province: toOptionalString(maybeAddress.province ?? maybeAddress.provinceCode),
    city: toOptionalString(maybeAddress.city),
    zip: toOptionalString(maybeAddress.zip ?? maybeAddress.zipCode),
  };

  return Object.values(address).some((part) => part !== undefined) ? address : undefined;
};

const normalizeCustomerPayload = (
  raw: Record<string, unknown>,
  organizationId: Id<"organizations">,
  now: number,
): NormalizedCustomer | null => {
  const storeId = raw.storeId as Id<"shopifyStores"> | undefined;
  const shopifyId = toOptionalString(raw.shopifyId ?? raw.id);

  if (!storeId || !shopifyId) {
    return null;
  }

  const ordersCount = Number.isFinite(raw.ordersCount)
    ? Number(raw.ordersCount)
    : 0;
  const totalSpent = Number.isFinite(raw.totalSpent)
    ? Number(raw.totalSpent)
    : 0;

  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[])
        .map((tag) => toOptionalString(tag))
        .filter((tag): tag is string => Boolean(tag))
        .sort()
    : undefined;

  return {
    organizationId,
    storeId,
    shopifyId,
    email: toOptionalString(raw.email),
    phone: toOptionalString(raw.phone),
    firstName: toOptionalString(raw.firstName),
    lastName: toOptionalString(raw.lastName),
    ordersCount,
    totalSpent,
    state: toOptionalString(raw.state),
    verifiedEmail:
      typeof raw.verifiedEmail === "boolean" ? raw.verifiedEmail : undefined,
    taxExempt:
      typeof raw.taxExempt === "boolean" ? raw.taxExempt : undefined,
    defaultAddress: normalizeCustomerAddress(raw.defaultAddress),
    tags,
    note: toOptionalString(raw.note),
    shopifyCreatedAt: Number.isFinite(raw.shopifyCreatedAt)
      ? Number(raw.shopifyCreatedAt)
      : now,
    shopifyUpdatedAt: Number.isFinite(raw.shopifyUpdatedAt)
      ? Number(raw.shopifyUpdatedAt)
      : now,
    syncedAt: raw.syncedAt && Number.isFinite(raw.syncedAt)
      ? Number(raw.syncedAt)
      : now,
  };
};

const addressesEqual = (
  a: CustomerAddress | undefined,
  b: CustomerAddress | undefined,
) => {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.country === b.country &&
    a.province === b.province &&
    a.city === b.city &&
    a.zip === b.zip
  );
};

const arraysEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
};

const hasCustomerChanges = (
  existing: Doc<"shopifyCustomers">,
  next: NormalizedCustomer,
) => {
  return (
    existing.email !== next.email ||
    existing.phone !== next.phone ||
    existing.firstName !== next.firstName ||
    existing.lastName !== next.lastName ||
    existing.ordersCount !== next.ordersCount ||
    existing.totalSpent !== next.totalSpent ||
    existing.state !== next.state ||
    existing.verifiedEmail !== next.verifiedEmail ||
    existing.taxExempt !== next.taxExempt ||
    !addressesEqual(existing.defaultAddress, next.defaultAddress) ||
    !arraysEqual(existing.tags, next.tags) ||
    existing.note !== next.note ||
    existing.shopifyCreatedAt !== next.shopifyCreatedAt ||
    existing.shopifyUpdatedAt !== next.shopifyUpdatedAt
  );
};

export const storeCustomersInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customers: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.customers || args.customers.length === 0) {
      return null;
    }

    const organizationId = args.organizationId as Id<"organizations">;
    const now = Date.now();

    const customersByStore = new Map<Id<"shopifyStores">, NormalizedCustomer[]>();

    for (const raw of args.customers) {
      const normalized = normalizeCustomerPayload(raw, organizationId, now);

      if (!normalized) {
        logger.warn("Skipping Shopify customer without storeId or shopifyId", {
          organizationId: String(organizationId),
          raw,
        });
        continue;
      }

      const list = customersByStore.get(normalized.storeId) ?? [];
      list.push(normalized);
      customersByStore.set(normalized.storeId, list);
    }

    let inserted = 0;
    let updated = 0;

    for (const [storeId, customers] of customersByStore.entries()) {
      const existingByShopifyId = new Map<string, Doc<"shopifyCustomers">>();

      for (const batch of chunkArray(
        customers.map((customer) => customer.shopifyId),
        BULK_OPS.LOOKUP_SIZE,
      )) {
        const results = await Promise.all(
          batch.map((shopifyId) =>
            ctx.db
              .query("shopifyCustomers")
              .withIndex("by_shopify_id_store", (q) =>
                q.eq("shopifyId", shopifyId).eq("storeId", storeId)
              )
              .first(),
          ),
        );

        results.forEach((doc, index) => {
          if (doc) {
            existingByShopifyId.set(batch[index]!, doc);
          }
        });
      }

      for (const customer of customers) {
        const existing = existingByShopifyId.get(customer.shopifyId);

        if (existing) {
          if (hasCustomerChanges(existing, customer)) {
            await ctx.db.patch(existing._id, {
              ...customer,
              syncedAt: now,
            });
            updated += 1;
          }
        } else {
          await ctx.db.insert("shopifyCustomers", customer);
          inserted += 1;
        }
      }
    }

    logger.info("Processed Shopify customers", {
      organizationId: String(organizationId),
      received: args.customers.length,
      inserted,
      updated,
    });

    return null;
  },
});


export const upsertCustomerFromWebhook = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    storeId: v.id("shopifyStores"),
    customer: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shopifyId = String(args.customer.id);
    const existing = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id_store", (q) =>
        q.eq("shopifyId", shopifyId).eq("storeId", args.storeId),
      )
      .first();

    const doc = {
      organizationId: args.organizationId as Id<"organizations">,
      storeId: args.storeId as Id<"shopifyStores">,
      shopifyId,
      email: toOptionalString(args.customer.email),
      phone: toOptionalString(args.customer.phone),
      firstName: toOptionalString(args.customer.first_name),
      lastName: toOptionalString(args.customer.last_name),
      ordersCount: existing?.ordersCount ?? 0,
      totalSpent: existing?.totalSpent ?? 0,
      tags:
        typeof args.customer.tags === "string"
          ? (args.customer.tags as string).split(",").map((t) => t.trim()).filter(Boolean)
          : Array.isArray(args.customer.tags)
            ? (args.customer.tags as string[]).map((t) => String(t).trim()).filter(Boolean)
            : [],
      shopifyCreatedAt: toMs(args.customer.created_at) ?? Date.now(),
      shopifyUpdatedAt: toMs(args.customer.updated_at) ?? Date.now(),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("shopifyCustomers", doc);
    }

    return null;
  },
});

/**
 * Delete a product and its variants/inventory by Shopify ID
 */

export const deleteCustomerInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.customerId))
      .first();

    if (customer) {
      await ctx.db.delete(customer._id);
    }

    return null;
  },
});


export const updateCustomerStatusInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    customerId: v.string(),
    state: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("shopifyCustomers")
      .withIndex("by_shopify_id", (q) => q.eq("shopifyId", args.customerId))
      .first();

    if (customer) {
      await ctx.db.patch(customer._id, {
        state: args.state,
        shopifyUpdatedAt: Date.now(),
      });
    }

    return null;
  },
});
