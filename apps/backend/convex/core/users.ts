import {
  createAccount,
  modifyAccountCredentials,
  retrieveAccount,
  getAuthUserId,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalQuery, mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

/**
 * User management and Clerk webhook handling
 */

// User validator for returns types
const _userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  emailVerified: v.optional(v.boolean()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  isAnonymous: v.optional(v.boolean()),
  organizationId: v.optional(v.string()),
  organizationName: v.optional(v.string()),
  globalRole: v.optional(
    v.union(
      v.literal("MeyooFounder"),
      v.literal("MeyooAdmin"),
      v.literal("MeyooTeam"),
    ),
  ),
  plan: v.optional(
    v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("growth"),
      v.literal("business"),
    ),
  ),
  mobileNumber: v.optional(v.string()),
  onboardingStep: v.optional(v.number()),
  isOnboarded: v.optional(v.boolean()),
  onboardingData: v.optional(
    v.object({
      referralSource: v.optional(v.string()),
      setupDate: v.optional(v.string()),
      completedSteps: v.optional(v.array(v.string())),
    }),
  ),
  timezone: v.optional(v.string()),
  locale: v.optional(v.string()),
  emailNotifications: v.optional(v.boolean()),
  marketingEmails: v.optional(v.boolean()),
  twoFactorEnabled: v.optional(v.boolean()),
  hasShopifyConnection: v.optional(v.boolean()),
  hasMetaConnection: v.optional(v.boolean()),
  hasGoogleConnection: v.optional(v.boolean()),
  isInitialSyncComplete: v.optional(v.boolean()),
  // Legacy cost setup flags removed; onboarding table tracks step 5/6 now
  status: v.optional(
    v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("invited"),
      v.literal("suspended"),
      v.literal("deleted"),
    ),
  ),
  deletedAt: v.optional(v.number()),
  lastLoginAt: v.optional(v.number()),
  loginCount: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

// ============ QUERIES ============

/**
 * Get current authenticated user
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    return auth?.user ?? null;
  },
});

/**
 * Get user by ID
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get user's billing information
 */
export const getUserBilling = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      plan: v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("growth"),
        v.literal("business"),
      ),
      isPremium: v.boolean(),
      status: v.optional(
        v.union(
          v.literal("active"),
          v.literal("trial"),
          v.literal("cancelled"),
          v.literal("suspended"),
        ),
      ),
      billingCycle: v.optional(
        v.union(v.literal("monthly"), v.literal("yearly")),
      ),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const user = auth.user;

    // Get billing info for user's organization
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .first();

    if (!billing) {
      // Return default free plan if no billing record exists
      return {
        plan: "free" as const,
        isPremium: false,
        status: "active" as const,
        billingCycle: "monthly" as const,
      };
    }

    const plan = billing.shopifyBilling?.plan ?? "free";

    return {
      plan: plan as "free" | "starter" | "growth" | "business",
      isPremium: billing.isPremium,
      status: billing.status,
      billingCycle: billing.billingCycle,
    };
  },
});

/**
 * Get usage data for current user's organization (last 30 days)
 */
export const getUserUsage = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      ordersLast30Days: v.number(),
      orderLimit: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;

    // Calculate date 30 days ago
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10); // YYYY-MM-DD

    // Get daily metrics for the last 30 days
    const dailyMetrics = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_organization_date", (q) =>
        q
          .eq("organizationId", auth.user.organizationId as Id<"organizations">)
          .gte("date", startDate)
      )
      .collect();

    // Sum total orders from last 30 days
    const ordersLast30Days = dailyMetrics.reduce((sum, metric) => {
      return sum + (metric.totalOrders ?? 0);
    }, 0);

    // Get plan limits
    const billing = await ctx.db
      .query("billing")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", auth.user.organizationId as Id<"organizations">),
      )
      .first();

    const plan = billing?.shopifyBilling?.plan ?? "free";

    const planLimits: Record<string, number> = {
      free: 300,
      starter: 1200,
      growth: 3000,
      business: 7500,
    };

    return {
      ordersLast30Days,
      orderLimit: planLimits[plan] ?? 300,
    };
  },
});

/**
 * Get team members for organization
 */
export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;

    return await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .collect();
  },
});

// ============ MUTATIONS ============

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    timezone: v.optional(v.string()),
    notificationPreferences: v.optional(
      v.object({
        email: v.boolean(),
        push: v.boolean(),
        sms: v.boolean(),
      }),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const updates: Partial<{
      updatedAt: number;
      name: string;
      email: string;
      phone: string;
      timezone: string;
      notificationPreferences: {
        email: boolean;
        push: boolean;
        sms: boolean;
      };
    }> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.notificationPreferences !== undefined) {
      updates.notificationPreferences = args.notificationPreferences;
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

/**
 * Invite team member
 */
export const inviteTeamMember = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("StoreTeam")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireUserAndOrg(ctx);

    // Check if user has permission to invite
    if (membership?.role !== "StoreOwner") {
      throw new Error("Insufficient permissions to invite team members");
    }

    // Create invitation (email sending to be implemented)

    return {
      success: true,
      message: `Invitation sent to ${args.email}`,
    };
  },
});

/**
 * Update organization name for all users in organization
 */
export const updateOrganizationName = mutation({
  args: {
    organizationName: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user, membership } = await requireUserAndOrg(ctx);

    // Check permissions - only StoreOwner can update organization name
    const isStoreOwner = membership?.role === "StoreOwner";
    const globalRole = user.globalRole;
    if (
      !isStoreOwner &&
      globalRole !== "MeyooFounder" &&
      globalRole !== "MeyooAdmin"
    ) {
      throw new Error("Insufficient permissions to update organization name");
    }

    if (!user.organizationId) {
      throw new Error("No organization found");
    }

    // Update the organization name
    await ctx.db.patch(user.organizationId, {
      name: args.organizationName,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update user business profile
 */
export const updateBusinessProfile = mutation({
  args: {
    mobileNumber: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const updates: Partial<{
      updatedAt: number;
      phone: string;
      mobileNumber?: string;
    }> = {
      updatedAt: Date.now(),
    };

    if (args.mobileNumber !== undefined) {
      updates.mobileNumber = args.mobileNumber;
      updates.phone = args.mobileNumber;
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// ============ INTERNAL QUERIES ============

/**
 * Get users by organization (internal)
 */
export const getUsersByOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId as Id<"organizations">),
      )
      .collect();
  },
});

/**
 * Internal query to get user by ID
 */
export const getById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// ============ HELPER FUNCTIONS ============

/**
 * Check if user has permission for action
 */
export function hasPermission(
  storeRole: Doc<"memberships">["role"] | null | undefined,
  globalRole: Doc<"users">["globalRole"] | null | undefined,
  action: "view" | "edit" | "delete" | "admin",
): boolean {
  if (storeRole === "StoreOwner") {
    return true;
  }

  if (globalRole === "MeyooFounder" || globalRole === "MeyooAdmin") {
    return true;
  }

  if (storeRole === "StoreTeam" || globalRole === "MeyooTeam") {
    return action === "view" || action === "edit";
  }

  return false;
}

/**
 * Check if the current user has a password account
 */
export const hasPasswordAccount = action({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Add type annotation to fix circular reference
    const user = (await ctx.runQuery(internal.core.users.getById, {
      userId,
    })) as unknown as {
      email?: string;
      name?: string;
    } | null;

    if (!user || !user.email) {
      return false;
    }

    try {
      // Normalize email for consistent account ID
      const normalizedEmail = user.email.toLowerCase().trim();

      // Check if user has a password account by trying to retrieve it
      const account = (await retrieveAccount(ctx, {
        provider: "password",
        account: { id: normalizedEmail },
      })) as unknown | null;

      return account !== null;
    } catch (_error) {
      // If there's an error retrieving the account, assume no password
      return false;
    }
  },
});

/**
 * Change or set user password
 */
export const changePassword = action({
  args: {
    currentPassword: v.optional(v.string()),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Add type annotation to fix circular reference
    const user = (await ctx.runQuery(internal.core.users.getById, {
      userId,
    })) as unknown as { email?: string; name?: string } | null;

    // Enhanced validation
    if (!user) {
      throw new ConvexError("User not found");
    }

    if (!user.email) {
      console.error("User data missing email:", {
        userId,
        userName: user.name,
      });
      throw new ConvexError(
        "Email address is required to set a password. Please ensure your account has an email address.",
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(user.email)) {
      console.error("Invalid email format:", user.email);
      throw new ConvexError("Invalid email address format");
    }

    // Validate new password
    if (args.newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    // Normalize email for consistent account ID
    const normalizedEmail = user.email.toLowerCase().trim();

    // production: avoid logging password change attempts

    try {
      // Check if user already has a password
      let existingAccount: unknown | null = null;

      try {
        existingAccount = await retrieveAccount(ctx, {
          provider: "password",
          account: { id: normalizedEmail },
        });
      } catch (error) {
        // If the error message contains "InvalidAccountId", it means no password account exists
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (!errorMessage.includes("InvalidAccountId")) {
          // Re-throw if it's a different error
          throw error;
        }
        // Otherwise, existingAccount remains null (no password account)
        // production: avoid noisy logs
      }

      if (existingAccount) {
        // User has a password, verify current password
        if (!args.currentPassword) {
          throw new ConvexError("Current password is required");
        }

        // Verify current password
        try {
          const validPassword = (await retrieveAccount(ctx, {
            provider: "password",
            account: {
              id: normalizedEmail,
              secret: args.currentPassword,
            },
          })) as unknown | null;

          if (!validPassword) {
            throw new ConvexError("Current password is incorrect");
          }
        } catch (error) {
          // Handle password verification errors
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // If it's an InvalidSecret error, provide a user-friendly message
          if (errorMessage.includes("InvalidSecret")) {
            throw new ConvexError("Current password is incorrect");
          }

          // Re-throw other errors
          throw error;
        }
      }

      // Update or create password
      if (existingAccount) {
        // User already has a password, update it
        await modifyAccountCredentials(ctx, {
          provider: "password",
          account: {
            id: normalizedEmail,
            secret: args.newPassword,
          },
        });
      } else {
        // User doesn't have a password yet, create account
        // production: avoid noisy logs

        // Prepare profile data - only include defined values
        const profile: Record<string, unknown> = {
          email: normalizedEmail,
        };

        if (user.name) {
          profile.name = user.name;
        }

        await createAccount(ctx, {
          provider: "password",
          account: {
            id: normalizedEmail,
            secret: args.newPassword,
          },
          profile,
          shouldLinkViaEmail: true,
        });

        // production: avoid noisy logs
      }

      return {
        success: true,
        message: existingAccount
          ? "Password updated successfully"
          : "Password set successfully",
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      console.error("Password update error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update password";

      throw new ConvexError(errorMessage);
    }
  },
});

/**
 * Change user email (optionally preserving password credentials)
 */
export const changeEmail = action({
  args: {
    newEmail: v.string(),
    currentPassword: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const user = (await ctx.runQuery(internal.core.users.getById, {
      userId,
    })) as unknown as { email?: string; name?: string } | null;

    if (!user) throw new ConvexError("User not found");

    const currentEmail = (user.email || "").trim().toLowerCase();
    const newEmail = args.newEmail.trim().toLowerCase();

    if (!newEmail) throw new ConvexError("New email is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      throw new ConvexError("Enter a valid email address");
    }
    if (newEmail === currentEmail) {
      return { success: true, message: "Email unchanged" };
    }

    // Determine if user currently has a password account
    let hasPassword = false;
    try {
      const acct = (await retrieveAccount(ctx, {
        provider: "password",
        account: { id: currentEmail },
      })) as unknown | null;
      hasPassword = acct !== null;
    } catch (_) {
      hasPassword = false;
    }

    // If user has a password, verify current password and create credentials for new email
    if (hasPassword) {
      if (!args.currentPassword) {
        throw new ConvexError("Current password is required to change email");
      }

      // Verify current password is correct
      try {
        const valid = (await retrieveAccount(ctx, {
          provider: "password",
          account: { id: currentEmail, secret: args.currentPassword },
        })) as unknown | null;
        if (!valid) throw new Error("InvalidSecret");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("InvalidSecret") || msg.includes("incorrect")) {
          throw new ConvexError("Current password is incorrect");
        }
        // Re-throw other errors
        throw e;
      }

      // Ensure a password account exists for the new email using the same password
      try {
        // If account already exists, this may throw; we ignore duplicate case
        await createAccount(ctx, {
          provider: "password",
          account: { id: newEmail, secret: args.currentPassword },
          profile: {
            email: newEmail,
            ...(user.name ? { name: user.name } : {}),
          },
          shouldLinkViaEmail: true,
        });
      } catch (_e) {
        // If an account for newEmail already exists, ignore
      }
    }

    // Update user email
    await ctx.runMutation(api.core.users.updateProfile, {
      email: newEmail,
    });

    return { success: true };
  },
});
