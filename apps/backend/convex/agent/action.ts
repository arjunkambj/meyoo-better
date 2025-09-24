import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { createAgent, ensureThreadBelongsToUser } from "./agent";
import { requireUserAndOrg } from "../utils/auth";

type SendMessageOptions = {
  title?: string;
  system?: string;
  model?: string;
};

type SendMessageArgs = {
  threadId?: string;
  message: string;
  options?: SendMessageOptions;
};

type SendMessageUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type SendMessageResult = {
  threadId: string;
  usage?: SendMessageUsage;
  savedMessageIds: string[];
};

export const sendMessage = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    options: v.optional(
      v.object({
        title: v.optional(v.string()),
        system: v.optional(v.string()),
        model: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    threadId: v.string(),
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
    savedMessageIds: v.array(v.string()),
  }),
  handler: async (ctx: ActionCtx, args: SendMessageArgs): Promise<SendMessageResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const agentInstance = createAgent({ model: args.options?.model });

    let threadId = args.threadId ?? null;
    if (threadId) {
      await ensureThreadBelongsToUser(ctx, threadId, userId);
    } else {
      const { threadId: createdThreadId } = await agentInstance.createThread(ctx, {
        userId,
        title: args.options?.title?.trim() ? args.options.title.trim() : undefined,
      });
      threadId = createdThreadId;
    }

    if (!threadId) {
      throw new ConvexError("Failed to create conversation thread");
    }

    // Enrich system prompt with org/store currency to avoid generic "dollars"
    const { orgId } = await requireUserAndOrg(ctx);
    const store = await ctx.db
      .query("shopifyStores")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();
    const currencyCode = (store?.primaryCurrency as string | undefined) ?? "USD";
    const currencyInstruction = `Use the ${currencyCode} currency for all money amounts and format with the correct symbol; do not say the word 'dollars' unless the currency is USD.`;

    const combinedSystem = [args.options?.system, currencyInstruction]
      .filter(Boolean)
      .join(" ");

    const result = await agentInstance.streamText(
      ctx,
      { userId, threadId },
      {
        prompt: args.message,
        system: combinedSystem,
      },
      {
        storageOptions: { saveMessages: "all" },
        saveStreamDeltas: true,
      },
    );

    const usage = result.usage
      ? {
          inputTokens:
            typeof result.usage.inputTokens === "number"
              ? result.usage.inputTokens
              : undefined,
          outputTokens:
            typeof result.usage.outputTokens === "number"
              ? result.usage.outputTokens
              : undefined,
          totalTokens:
            typeof result.usage.totalTokens === "number"
              ? result.usage.totalTokens
              : undefined,
        }
      : undefined;

    return {
      threadId,
      usage,
      savedMessageIds:
        result.savedMessages?.map((message) => message._id) ?? [],
    };
  },
});

export const deleteThread = action({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx: ActionCtx, args: { threadId: string }): Promise<null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    await ensureThreadBelongsToUser(ctx, args.threadId, userId);

    await ctx.runAction(components.agent.threads.deleteAllForThreadIdSync, {
      threadId: args.threadId,
    });

    return null;
  },
});
