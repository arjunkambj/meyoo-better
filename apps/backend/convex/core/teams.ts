import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { createNewUserData, ensureActiveMembership, normalizeEmail } from "../authHelpers";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

/**
 * Team Management
 * Handles team member invitations, roles, and permissions
 */

/**
 * Get team statistics for an organization
 */
export const getTeamStats = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      totalMembers: v.number(),
      activeMembers: v.number(),
      pendingInvites: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return null;
    const user = auth.user;

    // Count memberships for this organization
    const orgId = user.organizationId as Id<"organizations">;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .collect();

    const visibleMemberships = memberships.filter(
      (membership) => membership.status !== "removed",
    );

    // Get pending invitations
    const allInvitations = await ctx.db
      .query("invites")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .collect();

    // Filter for pending invitations in memory
    const invitations = allInvitations.filter(
      (inv) => inv.status === "pending",
    );

    return {
      totalMembers: visibleMemberships.length,
      activeMembers: visibleMemberships.filter((m) => m.status === "active").length,
      pendingInvites: invitations.length,
    };
  },
});

/**
 * Check if current user can manage team
 */
export const canManageTeam = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return false;
    const user = auth.user;
    if (!user.organizationId) return false;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();

    if (!membership) return false;
    return membership.role === "StoreOwner";
  },
});

/**
 * Get team members for an organization
 */
export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;

    // Allow any member of the organization to view team members
    // Actions (invite/remove) are controlled separately by role checks

    const orgId = user.organizationId as Id<"organizations">;
    const memberships = (await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", orgId))
      .collect()).filter((membership) => membership.status !== "removed");

    const users = await Promise.all(memberships.map((m) => ctx.db.get(m.userId)));

    return memberships.map((m, i) => {
      const u = users[i]!;
      return {
        _id: u._id,
        _creationTime: u._creationTime,
        email: u.email,
        name: u.name,
        image: u.image,
        role: m.role,
        status: m.status,
        isOnboarded: u.isOnboarded,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });
  },
});

/**
 * Get pending invitations for an organization
 */
export const getInvitations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      _creationTime: v.number(),
      email: v.string(),
      role: v.optional(v.union(v.literal("StoreTeam"))),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("expired"),
        v.literal("cancelled"),
      ),
      invitedBy: v.object({
        name: v.optional(v.string()),
        email: v.string(),
      }),
      expiresAt: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;

    // Only allow owners/admins to view invitations
    if (
      !user.role ||
      !["StoreOwner", "MeyooFounder", "MeyooAdmin", "MeyooTeam"].includes(
        user.role,
      )
    ) {
      return [];
    }

    const allInvitations = await ctx.db
      .query("invites")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId as Id<"organizations">),
      )
      .collect();

    // Filter for pending invitations in memory
    const invitations = allInvitations.filter(
      (inv) => inv.status === "pending",
    );

    return invitations.map((invitation) => ({
      _id: invitation._id,
      _creationTime: invitation._creationTime,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    }));
  },
});

/**
 * Invite team member - Creates user directly in database
 */
export const inviteTeamMember = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("StoreTeam")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    userId: v.optional(v.id("users")),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    message: string;
    userId?: Id<"users">;
  }> => {
    const { user: inviter } = await requireUserAndOrg(ctx);

    if (!inviter) {
      throw new Error("User not found");
    }

    // Only store owners via membership can invite new members
    const inviterMembership = inviter.organizationId
      ? await ctx.db
          .query("memberships")
          .withIndex("by_org_user", (q) =>
            q
              .eq("organizationId", inviter.organizationId as Id<"organizations">)
              .eq("userId", inviter._id),
          )
          .first()
      : null;
    if (!inviterMembership || inviterMembership.role !== "StoreOwner") {
      throw new Error(
        "Only store owners can invite team members",
      );
    }

    if (!inviter.organizationId) {
      throw new Error("Organization not found");
    }

    const orgId = inviter.organizationId as Id<"organizations">;
    const orgPrimaryCurrency: string | null = await ctx.runQuery(
      api.core.currency.getPrimaryCurrencyForOrg,
      { orgId },
    );
    const resolvedCurrency: string =
      orgPrimaryCurrency ?? inviter.primaryCurrency ?? "USD";

    // Normalize email for consistent storage and lookups
    const targetEmail = normalizeEmail(args.email);

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", targetEmail))
      .first();

    if (existingUser) {
      // If user is already in an organization, determine if they can be moved
      if (existingUser.organizationId) {
        if (existingUser.organizationId === inviter.organizationId) {
          return {
            success: false,
            message: "User is already a member of your organization",
          };
        } else {
          // Check onboarding for the user's current organization
          const currentOrgOnboarding = await ctx.db
            .query("onboarding")
            .withIndex("by_organization", (q) =>
              q.eq(
                "organizationId",
                existingUser.organizationId as Id<"organizations">,
              ),
            )
            .collect();

          // If ANY user in that organization has a Shopify connection, treat the org as connected
          const hasShopifyConnection = currentOrgOnboarding.some(
            (o) => !!o.hasShopifyConnection,
          );

          if (hasShopifyConnection) {
            return {
              success: false,
              message:
                "User's current organization has an active Shopify connection; cannot be moved",
            };
          }

          // Safe to move the user to inviter's organization
          const now = Date.now();
          await ctx.db.patch(existingUser._id, {
            organizationId: inviter.organizationId,
            role: "StoreTeam",
            isOnboarded: true,
            status: "invited",
            updatedAt: now,
            primaryCurrency: resolvedCurrency,
          });
          const existingMembership = await ctx.db
            .query("memberships")
            .withIndex("by_org_user", (q) =>
              q
                .eq("organizationId", orgId)
                .eq("userId", existingUser._id),
            )
            .first();

          await ensureActiveMembership(ctx, orgId, existingUser._id, args.role, {
            seatType: existingMembership?.seatType ?? "free",
            hasAiAddOn: existingMembership?.hasAiAddOn ?? false,
            assignedAt: existingMembership?.assignedAt ?? now,
            assignedBy: existingMembership?.assignedBy ?? inviter._id,
          });

          return {
            success: true,
            message:
              "User was in another organization without Shopify connected and has been added to your team",
            userId: existingUser._id,
          };
        }
      }

      // User exists but not in any organization - add them to this org
      const now = Date.now();
      await ctx.db.patch(existingUser._id, {
        organizationId: inviter.organizationId,
        role: "StoreTeam",
        isOnboarded: true, // Skip onboarding for invited users
        status: "invited",
        updatedAt: now,
        primaryCurrency: resolvedCurrency,
      });
      await ensureActiveMembership(ctx, orgId, existingUser._id, args.role, {
        seatType: "free",
        hasAiAddOn: false,
        assignedAt: now,
        assignedBy: inviter._id,
      });

      return {
        success: true,
        message: `${args.email} has been added to your team. They can login using their existing account.`,
        userId: existingUser._id,
      };
    }

    // Create new user for the invited member
    const now = Date.now();
    const newUserId: Id<"users"> = await ctx.db.insert("users", {
      email: targetEmail,
      name: targetEmail.split("@")[0], // Use email prefix as default name
      organizationId: inviter.organizationId,
      role: "StoreTeam",
      status: "invited", // Mark as invited, not yet active
      isOnboarded: true, // Skip onboarding for invited users
      loginCount: 0,
      createdAt: now,
      updatedAt: now,
      primaryCurrency: resolvedCurrency,
    });

    await ensureActiveMembership(ctx, orgId, newUserId, args.role, {
      seatType: "free",
      hasAiAddOn: false,
      assignedAt: now,
      assignedBy: inviter._id,
    });

    // production: avoid logging invitations with emails/PII

    return {
      success: true,
      message: `Invitation sent to ${targetEmail}. They can login with their Google account using this email address.`,
      userId: newUserId,
    };
  },
});

/**
 * Remove team member
 */
export const removeTeamMember = mutation({
  args: {
    memberId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    // Only the StoreOwner can remove team members (via membership)
    const m = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();
    if (!m || m.role !== "StoreOwner") {
      throw new Error("Only the store owner can remove team members");
    }

    const memberToRemove = await ctx.db.get(args.memberId);

    if (!memberToRemove) {
      throw new Error("Member not found");
    }

    // Verify member belongs to same organization
    if (memberToRemove.organizationId !== user.organizationId) {
      throw new Error("Member not found in your organization");
    }

    // Cannot remove owners or other admins (via membership)
    const memberMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", args.memberId),
      )
      .first();
    if (memberMembership && memberMembership.role === "StoreOwner") {
      throw new Error("Cannot remove the store owner");
    }

    // Cannot remove self
    if (memberToRemove._id === user._id) {
      throw new Error("Cannot remove yourself");
    }

    const now = Date.now();

    // Mark membership removed before resetting the user's workspace context
    if (memberMembership && memberMembership.status !== "removed") {
      await ctx.db.patch(memberMembership._id, {
        status: "removed",
        updatedAt: now,
      });
    }

    // Move removed member into a fresh personal organization so they can re-onboard elsewhere
    await createNewUserData(ctx as unknown as MutationCtx, memberToRemove._id, {
      name: memberToRemove.name || null,
      email: memberToRemove.email || null,
    });

    return {
      success: true,
      message: "Team member access removed",
    };
  },
});

/**
 * Leave organization (for non-owners)
 * Resets the current user to a new organization like a fresh signup
 */
export const leaveOrganization = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const { user } = await requireUserAndOrg(ctx);
    if (!user?.organizationId) throw new Error("User has no organization");

    // Owners cannot leave their own organization via this endpoint
    if (user.role === "StoreOwner") {
      throw new Error("Store owners cannot leave their own organization");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();
    const now = Date.now();

    if (membership && membership.status !== "removed") {
      await ctx.db.patch(membership._id, {
        status: "removed",
        updatedAt: now,
      });
    }

    await createNewUserData(ctx as unknown as MutationCtx, user._id, {
      name: user.name || null,
      email: user.email || null,
    });

    return { success: true, message: "You have left the organization" };
  },
});

/**
 * Update team member role
 */
export const updateMemberRole = mutation({
  args: {
    memberId: v.id("users"),
    newRole: v.union(v.literal("StoreTeam")),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Only allow owners/admins to update member roles (via membership)
    const acting = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();
    if (!acting || acting.role !== "StoreOwner") {
      throw new Error("Insufficient permissions to update member roles");
    }

    const memberToUpdate = await ctx.db.get(args.memberId);

    if (!memberToUpdate) {
      throw new Error("Member not found");
    }

    // Verify member belongs to same organization
    if (memberToUpdate.organizationId !== user.organizationId) {
      throw new Error("Member not found in your organization");
    }

    const targetMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", args.memberId),
      )
      .first();
    if (targetMembership && targetMembership.role === "StoreOwner") {
      throw new Error("Cannot update the store owner's role");
    }

    // Cannot update self
    if (memberToUpdate._id === user._id) {
      throw new Error("Cannot update your own role");
    }

    if (!targetMembership) {
      throw new Error("Membership not found");
    }
    await ctx.db.patch(targetMembership._id, {
      role: args.newRole,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Cancel invitation
 */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("invites"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    if (!user?.organizationId) {
      throw new Error("User or organization not found");
    }

    // Only allow owners/admins to cancel invitations (via membership)
    const acting = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q
          .eq("organizationId", user.organizationId as Id<"organizations">)
          .eq("userId", user._id),
      )
      .first();
    if (!acting || acting.role !== "StoreOwner") {
      throw new Error("Insufficient permissions to cancel invitations");
    }

    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Verify invitation belongs to same organization
    if (invitation.organizationId !== user.organizationId) {
      throw new Error("Invitation not found in your organization");
    }

    // Update invitation status
    await ctx.db.patch(args.invitationId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============ INTERNAL FUNCTIONS ============

import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Internal query to get user by email
 */
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
  },
});

/**
 * Internal query to get pending invitation
 */
export const getPendingInvitation = internalQuery({
  args: {
    email: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_email_organization", (q) =>
        q.eq("email", args.email).eq("organizationId", args.organizationId),
      )
      .collect();

    // Filter for pending status in memory
    return invites.find((inv) => inv.status === "pending");
  },
});

/**
 * Internal mutation to create invited user
 * TODO: Update this for Convex Auth invitation flow
 */
// Commented out - needs to be updated for Convex Auth
// export const createInvitedUser = internalMutation({
//   args: {
//     email: v.string(),
//     organizationId: v.string(),
//     organizationId: v.string(),
//     role: v.union(v.literal("StoreTeam")),
//   },
//   handler: async (ctx, args) => {
//     // TODO: Implement invitation flow with Convex Auth
//     // This would need to create a pending invitation that gets linked
//     // when the user signs up with this email
//     throw new Error("Invitation flow needs to be updated for Convex Auth");
//   },
// });

/**
 * Internal mutation to create invitation record
 */
export const createInvitation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("StoreTeam")),
    invitedBy: v.object({
      id: v.id("users"),
      name: v.string(),
      email: v.string(),
    }),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invites", {
      organizationId: args.organizationId,
      type: "team_member",
      email: args.email,
      role: args.role,
      status: "pending",
      invitedBy: args.invitedBy,
      invitationToken: generateInvitationToken(),
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Helper functions
function generateInvitationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
