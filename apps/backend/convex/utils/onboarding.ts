import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

// Ensure an onboarding record exists and mark Shopify connection true
export async function ensureShopifyOnboarding(
  ctx: MutationCtx,
  userId: Id<'users'>,
  organizationId: Id<'organizations'>,
  now = Date.now(),
) {
  const onboarding = await ctx.db
    .query('onboarding')
    .withIndex('by_user_organization', (q: any) =>
      q.eq('userId', userId).eq('organizationId', organizationId),
    )
    .first();

  if (!onboarding) {
    await ctx.db.insert('onboarding', {
      userId,
      organizationId,
      onboardingStep: 1,
      isCompleted: false,
      hasShopifyConnection: true,
      hasMetaConnection: false,
      hasGoogleConnection: false,
      isInitialSyncComplete: false,
      isProductCostSetup: false,
      isExtraCostSetup: false,
      onboardingData: {
        completedSteps: ['shopify'],
        setupDate: new Date(now).toISOString(),
      },
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.patch(onboarding._id, {
    hasShopifyConnection: true,
    onboardingStep: 1,
    updatedAt: now,
    onboardingData: {
      ...(onboarding.onboardingData || {}),
      completedSteps: Array.from(
        new Set([...(onboarding.onboardingData?.completedSteps || []), 'shopify']),
      ),
    },
  });
}
