import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc, Id } from '../_generated/dataModel';
import { api } from '../_generated/api';
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server';
import { ConvexError } from 'convex/values';

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

async function loadUser(ctx: AnyCtx, userId: Id<'users'>) {
  if ('db' in ctx) {
    return await ctx.db.get(userId);
  }

  return await ctx.runQuery(api.core.users.getUser, { userId });
}

export type UserAndOrg = {
  user: Doc<'users'>;
  orgId: Id<'organizations'>;
};

// Non-throwing helper: return null when not available
export async function getUserAndOrg(ctx: AnyCtx): Promise<UserAndOrg | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await loadUser(ctx, userId);
  if (!user?.organizationId) return null;
  return { user, orgId: user.organizationId as Id<'organizations'> };
}

// Throwing variant for paths which expect hard failures
export async function requireUserAndOrg(ctx: AnyCtx): Promise<UserAndOrg> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Not authenticated');
  const user = await loadUser(ctx, userId);
  if (!user) throw new ConvexError('User not found');
  if (!user.organizationId) throw new ConvexError('Organization not found');
  return { user, orgId: user.organizationId as Id<'organizations'> };
}
