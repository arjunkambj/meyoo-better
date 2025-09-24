import { action, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { rag } from "../rag";
import { api, internal } from "../_generated/api";
import { resolveOrgIdForContext } from "../utils/org";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 30;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const computeBrandMetrics = internalQuery({
  args: {
    orgId: v.id("organizations"),
    since: v.number(),
  },
  handler: async (ctx, { orgId, since }) => {
    const orders = await ctx.db
      .query("shopifyOrders")
      .withIndex("by_organization_and_created", (q) =>
        q.eq("organizationId", orgId).gte("shopifyCreatedAt", since),
      )
      .collect();

    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.totalPrice ?? 0),
      0,
    );
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    const products = await ctx.db
      .query("shopifyProducts")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .take(5);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      currency: store?.primaryCurrency ?? "USD",
      storeName: store?.storeName ?? null,
      shopDomain: store?.shopDomain ?? null,
      sampleProducts: products.map((product) => product.title).filter(Boolean),
      connectedAt: store?._creationTime ?? null,
    };
  },
});

export const upsertBrandSummary = action({
  args: {
    lookbackDays: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
    shopDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await resolveOrgIdForContext(ctx, {
      organizationId: args.organizationId ?? null,
      shopDomain: args.shopDomain ?? null,
    });

    const lookback = args.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const since = Date.now() - lookback * DAY_MS;

    const org = await ctx.runQuery(api.core.organizations.getOrganization, {
      organizationId: orgId,
    });

    const metrics = await ctx.runQuery(
      internal.agent.brandSummary.computeBrandMetrics,
      {
        orgId,
        since,
      },
    );

    const brandName = org?.name ?? metrics.storeName ?? "Our Brand";
    const storefront = metrics.shopDomain
      ? `https://${metrics.shopDomain}`
      : undefined;

    const lines: string[] = [
      `Brand: ${brandName}`,
    ];

    if (storefront) {
      lines.push(`Primary Storefront: ${storefront}`);
    }

    if (metrics.totalOrders > 0) {
      lines.push(
        `Last ${lookback} days — Orders: ${metrics.totalOrders}, Revenue: ${formatCurrency(metrics.totalRevenue, metrics.currency)}, Average order value: ${formatCurrency(metrics.averageOrderValue, metrics.currency)}`,
      );
    } else {
      lines.push(`No Shopify orders recorded in the last ${lookback} days.`);
    }

    if (metrics.sampleProducts.length > 0) {
      lines.push(
        `Highlighted products: ${metrics.sampleProducts.join(", ")}`,
      );
    }

    const createdAt = org?.createdAt
      ? new Date(org.createdAt).toISOString().slice(0, 10)
      : metrics.connectedAt
      ? new Date(metrics.connectedAt).toISOString().slice(0, 10)
      : undefined;

    if (createdAt) {
      lines.push(`Brand onboarded on: ${createdAt}`);
    }

    const summary = lines.join("\n");

    await rag.add(ctx as any, {
      namespace: String(orgId),
      key: "brand-summary",
      text: summary,
      title: `${brandName} Overview`,
      filterValues: [
        { name: "type", value: "brand-summary" },
        { name: "resourceId", value: String(orgId) },
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        lookbackDays: lookback,
        storeName: metrics.storeName,
        shopDomain: metrics.shopDomain,
        currency: metrics.currency,
      },
      importance: 3,
    });

    return {
      summary,
      lookbackDays: lookback,
    };
  },
});
