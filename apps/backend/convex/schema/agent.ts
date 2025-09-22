import { defineTable } from "convex/server";
import { v } from "convex/values";

// Chat threads for AI conversations
export const chatThreads = defineTable({
  userId: v.id("users"),
  title: v.string(),
  lastMessageAt: v.number(),
  status: v.union(v.literal("active"), v.literal("archived")),
  metadata: v.optional(
    v.object({
      model: v.optional(v.string()),
      temperature: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
    })
  ),
})
  .index("by_user", ["userId"])
  .index("by_user_and_status", ["userId", "status"])
  .index("by_user_and_last_message", ["userId", "lastMessageAt"]);

// Messages within chat threads
export const messages = defineTable({
  threadId: v.id("chatThreads"),
  userId: v.id("users"),
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  content: v.string(),
  model: v.optional(v.string()),
  timestamp: v.number(),
  metadata: v.optional(
    v.object({
      tokens: v.optional(v.number()),
      functionCall: v.optional(v.string()),
      toolUse: v.optional(v.array(v.string())),
    })
  ),
})
  .index("by_thread", ["threadId"])
  .index("by_thread_and_timestamp", ["threadId", "timestamp"])
  .index("by_user", ["userId"]);