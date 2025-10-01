import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

type MembershipRole = Doc<"memberships">["role"];
type MembershipSeatType = Doc<"memberships">["seatType"];

type EnsureMembershipOptions = {
  seatType?: MembershipSeatType;
  hasAiAddOn?: boolean;
  assignedAt?: number;
  assignedBy?: Id<"users">;
};

function resolveMembershipRole(
  role: Doc<"users">["role"] | null | undefined,
): MembershipRole {
  return role === "StoreOwner" ? "StoreOwner" : "StoreTeam";
}

export async function ensureActiveMembership(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  role: MembershipRole,
  options: EnsureMembershipOptions = {},
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .first();

  const seatType: MembershipSeatType = existing?.seatType
    ?? options.seatType
    ?? "free";
  const hasAiAddOn = existing?.hasAiAddOn ?? options.hasAiAddOn ?? false;
  const hasAIAccess = seatType === "paid" || hasAiAddOn;
  const assignedAt = existing?.assignedAt ?? options.assignedAt ?? now;
  const assignedBy = existing?.assignedBy ?? options.assignedBy ?? userId;

  if (existing) {
    await ctx.db.patch(existing._id, {
      role,
      status: "active",
      seatType,
      hasAiAddOn,
      hasAIAccess,
      assignedAt,
      assignedBy,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("memberships", {
    organizationId,
    userId,
    role,
    status: "active",
    seatType,
    hasAiAddOn,
    hasAIAccess,
    assignedAt,
    assignedBy,
    createdAt: now,
    updatedAt: now,
  });
}

async function transferMembership(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  fromUserId: Id<"users">,
  toUserId: Id<"users">,
  roleFallback: MembershipRole,
) {
  const [source, target] = await Promise.all([
    ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", fromUserId),
      )
      .first(),
    ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", toUserId),
      )
      .first(),
  ]);

  const now = Date.now();

  if (source && target && source._id !== target._id) {
    const seatType = target.seatType ?? source.seatType ?? "free";
    const hasAiAddOn = target.hasAiAddOn ?? source.hasAiAddOn ?? false;
    const hasAIAccess = seatType === "paid" || hasAiAddOn;
    await ctx.db.patch(target._id, {
      role: target.role ?? source.role ?? roleFallback,
      status: "active",
      seatType,
      hasAiAddOn,
      hasAIAccess,
      assignedAt: target.assignedAt ?? source.assignedAt ?? now,
      assignedBy: target.assignedBy ?? source.assignedBy ?? toUserId,
      updatedAt: now,
    });
    await ctx.db.delete(source._id);
    return target;
  }

  if (source) {
    const seatType = source.seatType ?? "free";
    const hasAiAddOn = source.hasAiAddOn ?? false;
    const hasAIAccess = seatType === "paid" || hasAiAddOn;
    await ctx.db.patch(source._id, {
      userId: toUserId,
      role: source.role ?? roleFallback,
      status: "active",
      seatType,
      hasAiAddOn,
      hasAIAccess,
      assignedAt: source.assignedAt ?? now,
      assignedBy: source.assignedBy ?? toUserId,
      updatedAt: now,
    });
    return source;
  }

  if (target) {
    const seatType = target.seatType ?? "free";
    const hasAiAddOn = target.hasAiAddOn ?? false;
    const hasAIAccess = seatType === "paid" || hasAiAddOn;
    await ctx.db.patch(target._id, {
      role: target.role ?? roleFallback,
      status: "active",
      seatType,
      hasAiAddOn,
      hasAIAccess,
      assignedAt: target.assignedAt ?? now,
      assignedBy: target.assignedBy ?? toUserId,
      updatedAt: now,
    });
    return target;
  }

  return null;
}

export async function findExistingUser(
  ctx: MutationCtx,
  email: string | null | undefined,
  excludeUserId?: Id<"users">,
): Promise<Doc<"users"> | null> {
  if (!email) return null;

  const rawEmail = email;
  const normalized = normalizeEmail(email);

  // Prefer normalized email first
  let user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .first();

  if (!user && normalized !== rawEmail) {
    user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", rawEmail))
      .first();
  }

  if (user && excludeUserId && user._id === excludeUserId) {
    return null;
  }

  return (user as Doc<"users">) || null;
}

export async function handleInvitedUser(
  ctx: MutationCtx,
  authUserId: Id<"users">,
  invitedUser: Doc<"users">,
) {
  // If the invited user doc is the same as the authenticated user doc,
  // we should directly activate this account rather than trying to merge
  // and delete a placeholder user.
  const isSameUser = invitedUser._id === authUserId;

  // Check if invited user has store connection
  const hasStoreConnection = await ctx.db
    .query("onboarding")
    .withIndex("by_user", (q) => q.eq("userId", invitedUser._id))
    .first();

  if (hasStoreConnection?.hasShopifyConnection) {
    return false;
  }

  // Patch the authenticated user to active, preserving org/role
  await ctx.db.patch(authUserId, {
    organizationId: invitedUser.organizationId,
    role: invitedUser.role, // Preserve assigned role
    status: "active",
    isOnboarded: true,
    loginCount: (invitedUser.loginCount || 0) + 1,
    lastLoginAt: Date.now(),
    // Preserve original createdAt if present, otherwise keep as-is
    ...(invitedUser.createdAt ? { createdAt: invitedUser.createdAt } : {}),
    updatedAt: Date.now(),
    primaryCurrency: invitedUser.primaryCurrency || "USD",
  });

  // Ensure an onboarding record exists for this user/org
  if (invitedUser.organizationId) {
    const existingOnboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .first();

    if (!existingOnboarding) {
      await ctx.db.insert("onboarding", {
        userId: authUserId,
        organizationId: invitedUser.organizationId,
        onboardingStep: 5,
        isCompleted: true,
        hasShopifyConnection: true,
        hasMetaConnection: true,
        hasGoogleConnection: true,
        isInitialSyncComplete: true,
        isProductCostSetup: true,
        isExtraCostSetup: true,
        onboardingData: {
          completedSteps: ["shopify", "marketing", "complete"],
          setupDate: new Date().toISOString(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const orgId = invitedUser.organizationId as Id<"organizations">;
    const membershipRole = resolveMembershipRole(invitedUser.role);
    const transferred = await transferMembership(
      ctx,
      orgId,
      invitedUser._id,
      authUserId,
      membershipRole,
    );

    await ensureActiveMembership(ctx, orgId, authUserId, membershipRole, {
      seatType: transferred?.seatType,
      hasAiAddOn: transferred?.hasAiAddOn,
      assignedAt: transferred?.assignedAt,
      assignedBy: transferred?.assignedBy,
    });
  }

  // If we created a new auth user to replace a placeholder, delete the placeholder.
  if (!isSameUser) {
    await ctx.db.delete(invitedUser._id);
  }

  return true;
}

export async function handleExistingUser(
  ctx: MutationCtx,
  authUserId: Id<"users">,
  existingUser: Doc<"users">,
) {
  const existingOnboarding = await ctx.db
    .query("onboarding")
    .withIndex("by_user", (q) => q.eq("userId", existingUser._id))
    .first();

  // Allow merging if existing user has no org (was created via Shopify but not fully setup)
  // OR if they have a Shopify connection
  const shouldMerge =
    !existingUser.organizationId || existingOnboarding?.hasShopifyConnection;

  if (!shouldMerge) {
    return false;
  }

  // production: avoid noisy auth logs

  // If the existing user does not have an organization yet, create one
  let organizationId = existingUser.organizationId;
  if (!organizationId) {
    // production: avoid noisy auth logs
    const now = Date.now();
    organizationId = await ctx.db.insert("organizations", {
      name: existingUser.name ? `${existingUser.name}'s Store` : "My Store",
      ownerId: authUserId,
      isPremium: false,
      requiresUpgrade: false,
      locale: "en-US",
      timezone: "America/New_York",
      createdAt: now,
      updatedAt: now,
    });
  }

  // Copy data from existing user
  await ctx.db.patch(authUserId, {
    organizationId: organizationId,
    role: existingUser.role || "StoreOwner",
    status: "active",
    isOnboarded:
      existingUser.isOnboarded || existingOnboarding?.isCompleted || false,
    loginCount: (existingUser.loginCount || 0) + 1,
    lastLoginAt: Date.now(),
    createdAt: existingUser.createdAt || Date.now(),
    updatedAt: Date.now(),
    primaryCurrency: existingUser.primaryCurrency || "USD",
  });

  // Transfer onboarding record
  if (existingOnboarding) {
    await ctx.db.patch(existingOnboarding._id, {
      userId: authUserId,
      updatedAt: Date.now(),
    });
  }

  // Note: Avoid scanning and patching all stores during sign-in to reduce
  // the mutation read/write set and prevent snapshot conflicts.
  // Store ownership refresh can be handled separately if needed.

  // Update organization owner
  if (organizationId) {
    const orgId = organizationId as Id<"organizations">;
    const membershipRole = resolveMembershipRole(existingUser.role);
    const transferred = await transferMembership(
      ctx,
      orgId,
      existingUser._id,
      authUserId,
      membershipRole,
    );

    await ensureActiveMembership(ctx, orgId, authUserId, membershipRole, {
      seatType: transferred?.seatType,
      hasAiAddOn: transferred?.hasAiAddOn,
      assignedAt: transferred?.assignedAt,
      assignedBy: transferred?.assignedBy,
    });

    const org = await ctx.db.get(orgId);

    if (org) {
      await ctx.db.patch(org._id, {
        ownerId: authUserId,
        updatedAt: Date.now(),
      });
    }
  }

  // Delete old user record
  await ctx.db.delete(existingUser._id);

  return true;
}

interface AuthUser {
  name?: string | null;
  email?: string | null;
}

export async function createNewUserData(
  ctx: MutationCtx,
  userId: Id<"users">,
  authUser: AuthUser,
) {
  const now = Date.now();

  // Create organization
  const orgId = await ctx.db.insert("organizations", {
    name: authUser.name ? `${authUser.name}'s Store` : "My Store",
    ownerId: userId,
    isPremium: false,
    requiresUpgrade: false,
    locale: "en-US",
    timezone: "America/New_York",
    createdAt: now,
    updatedAt: now,
  });

  // Update user with organization
  await ctx.db.patch(userId, {
    organizationId: orgId,
    role: "StoreOwner",
    status: "active",
    isOnboarded: false,
    loginCount: 1,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
    primaryCurrency: "USD",
  });

  await ensureActiveMembership(ctx, orgId, userId, "StoreOwner", {
    assignedAt: now,
    assignedBy: userId,
  });

  // Create onboarding record
  await ctx.db.insert("onboarding", {
    userId: userId,
    organizationId: orgId,
    onboardingStep: 1,
    isCompleted: false,
    hasShopifyConnection: false,
    hasMetaConnection: false,
    hasGoogleConnection: false,
    isInitialSyncComplete: false,
    isProductCostSetup: false,
    isExtraCostSetup: false,
    onboardingData: {
      completedSteps: [],
      setupDate: new Date().toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  });

  // Do NOT create a billing record here.
  // A plan (including Free) must be explicitly selected via Shopify managed pricing.

  // Create default dashboard
  await ctx.db.insert("dashboards", {
    organizationId: orgId,
    name: "Main Dashboard",
    type: "main",
    isDefault: true,
    visibility: "private",
    createdBy: userId,
    updatedAt: now,
    config: {
      kpis: [
        "netProfit",
        "revenue",
        "netProfitMargin",
        "orders",
        "avgOrderValue",
        "blendedRoas",
        "blendedMarketingCost",
        "repeatCustomerRate",
        "moMRevenueGrowth",
      ],
      widgets: [
        "adSpendSummary",
        "customerSummary",
        "orderSummary",
      ],
    },
  });
}

export async function updateLoginTracking(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);

  if (!user) return;

  await ctx.db.patch(userId, {
    lastLoginAt: Date.now(),
    loginCount: (user.loginCount || 0) + 1,
    updatedAt: Date.now(),
  });

  if (user.organizationId) {
    await ensureActiveMembership(
      ctx,
      user.organizationId as Id<"organizations">,
      userId,
      resolveMembershipRole(user.role),
      {
        assignedBy: userId,
      },
    );
  }
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
