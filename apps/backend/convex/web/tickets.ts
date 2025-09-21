import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getUserAndOrg, requireUserAndOrg } from "../utils/auth";

/**
 * Tickets API
 * Support ticket management system
 */

/**
 * Create a new ticket
 */
export const createTicket = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    type: v.union(
      v.literal("sales"),
      v.literal("support"),
      v.literal("partnership"),
      v.literal("feedback"),
      v.literal("other"),
    ),
    subject: v.string(),
    message: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    ticketId: v.id("tickets"),
  }),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const userId: Id<'users'> | undefined = auth?.user?._id;
    const organizationId: Id<'organizations'> | undefined = auth?.orgId;

    const ticketId = await ctx.db.insert("tickets", {
      name: args.name,
      email: args.email,
      company: args.company,
      type: args.type,
      subject: args.subject,
      message: args.message,
      status: "open",
      priority: "medium",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId,
      organizationId,
    });

    return {
      success: true,
      ticketId,
    };
  },
});

/**
 * Get tickets for the current user
 */
export const getUserTickets = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("tickets"),
      type: v.string(),
      subject: v.string(),
      message: v.string(),
      status: v.string(),
      priority: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      resolvedAt: v.optional(v.number()),
      responseCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    if (!auth) return [];
    const user = auth.user;

    // Get tickets by email or user ID
    let tickets: Array<Doc<"tickets">> = [];
    if (user.email) {
      const userEmail = user.email;
      tickets = await ctx.db
        .query("tickets")
        .withIndex("by_email", (q) => q.eq("email", userEmail))
        .collect();
    }

    // Also get tickets by user ID if different
    const userIdTickets = await ctx.db
      .query("tickets")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Merge and deduplicate
    const ticketMap = new Map();

    [...tickets, ...userIdTickets].forEach((ticket) => {
      ticketMap.set(ticket._id, ticket);
    });
    tickets = Array.from(ticketMap.values());

    // Filter by status if specified
    if (args.status) {
      tickets = tickets.filter((t) => t.status === args.status);
    }

    // Sort by creation date (newest first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    if (args.limit) {
      tickets = tickets.slice(0, args.limit);
    }

    // Get response counts
    const ticketsWithResponses = await Promise.all(
      tickets.map(async (ticket) => {
        const responses = await ctx.db
          .query("ticketResponses")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        return {
          id: ticket._id,
          type: ticket.type,
          subject: ticket.subject,
          message: ticket.message,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          resolvedAt: ticket.resolvedAt,
          responseCount: responses.length,
        };
      }),
    );

    return ticketsWithResponses;
  },
});

/**
 * Get single ticket with responses
 */
export const getTicket = query({
  args: {
    ticketId: v.id("tickets"),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("tickets"),
      name: v.string(),
      email: v.string(),
      company: v.optional(v.string()),
      type: v.string(),
      subject: v.string(),
      message: v.string(),
      status: v.string(),
      priority: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      resolvedAt: v.optional(v.number()),
      responses: v.array(
        v.object({
          id: v.id("ticketResponses"),
          message: v.string(),
          authorName: v.string(),
          authorEmail: v.string(),
          isInternal: v.boolean(),
          createdAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const auth = await getUserAndOrg(ctx);
    const ticket = await ctx.db.get(args.ticketId);

    if (!ticket) return null;

    // Check access permissions
    if (auth?.user) {
      const user = auth.user;
      // Check if user owns the ticket or is admin
      const isOwner = ticket.userId === user._id || ticket.email === user.email;
      const isAdmin = user.role === "StoreOwner";

      if (!isOwner && !isAdmin) {
        return null; // No access
      }
    } else {
      // For non-authenticated users, we'd need a different access method
      // (e.g., ticket token in URL)
      return null;
    }

    // Get responses
    const responses = await ctx.db
      .query("ticketResponses")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    return {
      id: ticket._id,
      name: ticket.name,
      email: ticket.email,
      company: ticket.company,
      type: ticket.type,
      subject: ticket.subject,
      message: ticket.message,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
      responses: responses.map((r) => ({
        id: r._id,
        message: r.message,
        authorName: r.authorName,
        authorEmail: r.authorEmail,
        isInternal: r.isInternal,
        createdAt: r.createdAt,
      })),
    };
  },
});

/**
 * Add response to ticket
 */
export const addTicketResponse = mutation({
  args: {
    ticketId: v.id("tickets"),
    message: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    responseId: v.id("ticketResponses"),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const ticket = await ctx.db.get(args.ticketId);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Check if user can respond
    const isOwner = ticket.userId === user._id || ticket.email === user.email;
    const isAdmin = user.role === "StoreOwner";

    if (!isOwner && !isAdmin) {
      throw new Error("No permission to respond to this ticket");
    }

    // Add response
    const responseId = await ctx.db.insert("ticketResponses", {
      ticketId: args.ticketId,
      message: args.message,
      authorId: user._id,
      authorName: user.name || user.email || "",
      authorEmail: user.email || "",
      isInternal: isAdmin && !isOwner,
      createdAt: Date.now(),
    });

    // Update ticket timestamp and status
    await ctx.db.patch(args.ticketId, {
      updatedAt: Date.now(),
      status: ticket.status === "open" ? "in_progress" : ticket.status,
    });

    return {
      success: true,
      responseId,
    };
  },
});

/**
 * Update ticket status
 */
// Admin/Meyoo ticket status updates moved to convex/meyoo/tickets.ts

/**
 * Delete a ticket
 */
export const deleteTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireUserAndOrg(ctx);

    const ticket = await ctx.db.get(args.ticketId);

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Check permissions - only ticket owner or admin can delete
    const isOwner = ticket.userId === user._id || ticket.email === user.email;
    const isAdmin = user.role === "StoreOwner";

    if (!isOwner && !isAdmin) {
      throw new Error("No permission to delete this ticket");
    }

    // Delete all ticket responses first
    const responses = await ctx.db
      .query("ticketResponses")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    for (const response of responses) {
      await ctx.db.delete(response._id);
    }

    // Delete the ticket
    await ctx.db.delete(args.ticketId);

    return { success: true };
  },
});

/**
 * Get all tickets (admin only)
 */
// Admin/Meyoo list of all tickets moved to convex/meyoo/tickets.ts
