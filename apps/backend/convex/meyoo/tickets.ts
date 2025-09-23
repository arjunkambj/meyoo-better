import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Meyoo/Admin-side ticket management

export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("tickets"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    // Only admins can change status; owners can close their own tickets via user API
    const isAdmin =
      user.role === "MeyooFounder" ||
      user.role === "MeyooAdmin" ||
      user.role === "MeyooTeam" ||
      user.role === "StoreOwner"; // keep StoreOwner elevated

    if (!isAdmin) throw new Error("No permission to update ticket status");

    const updateData: {
      status: "open" | "in_progress" | "resolved" | "closed";
      updatedAt: number;
      resolvedAt?: number;
    } = { status: args.status, updatedAt: Date.now() };

    if (args.status === "resolved" || args.status === "closed") {
      updateData.resolvedAt = Date.now();
    }

    await ctx.db.patch(args.ticketId, updateData);
    return { success: true };
  },
});

export const getAllTickets = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("tickets"),
      name: v.string(),
      email: v.string(),
      company: v.optional(v.string()),
      type: v.string(),
      subject: v.string(),
      status: v.string(),
      priority: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      responseCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);

    const isMeyooOrAdmin =
      !!user &&
      (user.role === "MeyooFounder" ||
        user.role === "MeyooAdmin" ||
        user.role === "MeyooTeam" ||
        user.role === "StoreOwner");
    if (!isMeyooOrAdmin) return [];

    // Use index for efficient ordering by creation time
    let tickets: Doc<"tickets">[] = await ctx.db
      .query("tickets")
      .withIndex("by_created", (q) => q.gte("createdAt", 0))
      .order("desc")
      .take(args.limit ?? 100);
    if (args.status) tickets = tickets.filter((t) => t.status === args.status);
    if (args.priority) tickets = tickets.filter((t) => t.priority === args.priority);

    const ticketsWithCounts = await Promise.all(
      tickets.map(async (ticket: Doc<"tickets">) => {
        const responses = await ctx.db
          .query("ticketResponses")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        return {
          id: ticket._id,
          name: ticket.name,
          email: ticket.email,
          company: ticket.company,
          type: ticket.type,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          responseCount: responses.length,
        };
      }),
    );

    return ticketsWithCounts;
  },
});
