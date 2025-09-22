import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { agentTools } from "./tools";

type AnyCtx = MutationCtx | ActionCtx;
type RegisteredTools = typeof agentTools;

const DEFAULT_MODEL = "openai:gpt-4o-mini";
const DEFAULT_NAME = "Meyoo Assistant";
const buildDefaultInstructions = (currentDate: string) =>
  [
    "You are Meyoo's commerce operations copilot.",
    "Provide concise, actionable responses grounded in the merchant's data when available.",
    `Today's date is ${currentDate} (YYYY-MM-DD).`,
    'Use available tools when they can improve accuracy, and prefer ISO 8601 date formatting in replies.',
  ].join(' ');

export function createAgent(options?: {
  name?: string;
  model?: string;
  instructions?: string;
}): Agent<object, RegisteredTools> {
  const currentDate = new Date().toISOString().slice(0, 10);
  return new Agent<object, RegisteredTools>(components.agent, {
    name: options?.name ?? DEFAULT_NAME,
    languageModel: options?.model ?? DEFAULT_MODEL,
    instructions: options?.instructions ?? buildDefaultInstructions(currentDate),
    tools: agentTools,
  });
}

export type AgentInstance = ReturnType<typeof createAgent>;

export async function ensureThreadBelongsToUser(
  ctx: AnyCtx,
  threadId: string,
  userId: string
) {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  if (!thread || thread.userId !== userId) {
    throw new ConvexError("Thread not found");
  }
  return thread;
}
