import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { query } from '../_generated/server';

// Returns the primary currency code for an organization, or null if not set
export const getPrimaryCurrencyForOrg = query({
  args: { orgId: v.id('organizations') },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const store = await ctx.db
      .query('shopifyStores')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.orgId as Id<'organizations'>))
      .first();
    return (store?.primaryCurrency as string | undefined) ?? null;
  },
});

