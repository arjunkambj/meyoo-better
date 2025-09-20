import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export const PLAN_PRICES = {
  free: 0,
  starter: 40,
  growth: 90,
  business: 160,
} as const;

type Plan = keyof typeof PLAN_PRICES;

function makeInvoiceNumber(now = new Date()): string {
  return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${
    Math.random().toString(36).slice(2, 6).toUpperCase()
  }`;
}

export async function createMonthlyInvoiceIfMissing(
  ctx: MutationCtx,
  args: {
    organizationId: Id<'organizations'>;
    ownerId: Id<'users'>;
    plan: Plan;
    subscriptionId?: string;
    description?: string;
    currency?: string;
    matchBySubscription?: boolean;
  },
) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const existing = await ctx.db
    .query('invoices')
    .withIndex('by_organization', (q: any) => q.eq('organizationId', args.organizationId))
    .collect();

  const alreadyHasInvoice = existing.some((inv: any) => {
    if (inv.billingPeriodStart !== periodStart) return false;
    if (args.matchBySubscription) return inv.shopifySubscriptionId === args.subscriptionId;
    return inv.plan === args.plan;
  });

  if (alreadyHasInvoice) return;

  const amount = PLAN_PRICES[args.plan] || 0;
  await ctx.db.insert('invoices', {
    organizationId: args.organizationId,
    userId: args.ownerId,
    invoiceNumber: makeInvoiceNumber(now),
    amount,
    currency: args.currency || 'USD',
    status: 'paid',
    plan: args.plan,
    description: `${args.description || args.plan} - Monthly`,
    shopifySubscriptionId: args.subscriptionId,
    lineItems: [
      {
        description: `${args.description || args.plan} Plan`,
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ],
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    issuedAt: Date.now(),
    paidAt: Date.now(),
    createdAt: Date.now(),
    metadata: {},
  });
}
