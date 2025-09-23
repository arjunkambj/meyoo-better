import { getAuthUserId } from "@convex-dev/auth/server";
import { listUIMessages } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { components } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { ensureThreadBelongsToUser } from "./agent";

export const listThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        threadId: v.string(),
        title: v.optional(v.string()),
        summary: v.optional(v.string()),
        status: v.union(v.literal("active"), v.literal("archived")),
        createdAt: v.number(),
      }),
    ),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const result = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId,
      order: "desc",
      paginationOpts: {
        cursor: args.paginationOpts.cursor ?? null,
        numItems: args.paginationOpts.numItems ?? 50,
      },
  });

    return {
      page: result.page.map((thread) => ({
        threadId: thread._id,
        title: thread.title ?? undefined,
        summary: thread.summary ?? undefined,
        status: thread.status,
        createdAt: thread._creationTime,
      })),
      continueCursor: result.continueCursor ?? null,
      isDone: result.isDone,
    };
  },
});

export const renameThread = mutation({
  args: {
    threadId: v.string(),
    title: v.string(),
  },
  returns: v.object({ threadId: v.string(), title: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const thread = await ensureThreadBelongsToUser(ctx, args.threadId, userId);

    const normalizedTitle = args.title.trim();
    const updated = await ctx.runMutation(components.agent.threads.updateThread, {
      threadId: thread._id,
      patch: {
        title: normalizedTitle.length > 0 ? normalizedTitle : undefined,
      },
    });

    return {
      threadId: updated._id,
      title: updated.title ?? undefined,
    };
  },
});

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.any()),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });

    if (!thread || thread.userId !== userId) {
      throw new ConvexError("Thread not found");
    }

    const result = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: {
        cursor: args.paginationOpts.cursor ?? null,
        numItems: args.paginationOpts.numItems ?? 40,
      },
  });

    return {
      page: result.page,
      continueCursor: result.continueCursor ?? null,
      isDone: result.isDone,
    };
  },
});
