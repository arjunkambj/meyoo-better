import { defineTable } from "convex/server";
import { v } from "convex/values";

// Support tickets table
export const tickets = defineTable({
  // Contact information
  name: v.string(),
  email: v.string(),
  company: v.optional(v.string()),

  // Ticket details
  type: v.union(
    v.literal("sales"),
    v.literal("support"),
    v.literal("partnership"),
    v.literal("feedback"),
    v.literal("other"),
  ),
  subject: v.string(),
  message: v.string(),

  // Status tracking
  status: v.union(
    v.literal("open"),
    v.literal("in_progress"),
    v.literal("resolved"),
    v.literal("closed"),
  ),
  priority: v.union(
    v.literal("low"),
    v.literal("medium"),
    v.literal("high"),
    v.literal("urgent"),
  ),

  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
  resolvedAt: v.optional(v.number()),

  // For logged-in users
  userId: v.optional(v.id("users")),
  organizationId: v.optional(v.id("organizations")),
})
  .index("by_email", ["email"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_created", ["createdAt"]);

// Ticket responses/comments
export const ticketResponses = defineTable({
  ticketId: v.id("tickets"),
  message: v.string(),

  // Author info
  authorId: v.optional(v.id("users")), // Internal team member
  authorName: v.string(),
  authorEmail: v.string(),
  isInternal: v.boolean(), // true for team, false for customer

  // Metadata
  createdAt: v.number(),
}).index("by_ticket", ["ticketId"]);
