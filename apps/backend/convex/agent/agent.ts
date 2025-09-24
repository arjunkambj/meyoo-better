import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { stepCountIs } from "ai";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { agentTools } from "./tools";

type AnyCtx = MutationCtx | ActionCtx;
type RegisteredTools = typeof agentTools;

const DEFAULT_MODEL_ID = "gpt-4.1";
const DEFAULT_NAME = "Meyoo Assistant";
const buildDefaultInstructions = (currentDate: string) =>
  [
    "You are Meyoo's commerce operations copilot.",
    "Provide concise, actionable responses grounded in the merchant's data when available.",
    `Today's date is ${currentDate} (YYYY-MM-DD).`,
    'Use available tools when they can improve accuracy, and prefer ISO 8601 date formatting in replies.',
    'Do not write or show code or API calls unless explicitly requested; prefer plain language answers.',
    'Use the provided Convex tools (ordersSummary, inventoryLowStock, analyticsSummary, pnlSnapshot, brandSummary, productsInventory, orgMembers) instead of ad-hoc calculations when possible.',
  ].join(' ');

export function createAgent(options?: {
  name?: string;
  model?: string; // e.g. "gpt-4o-mini" or "openai:gpt-4o-mini"
  instructions?: string;
}): Agent<object, RegisteredTools> {
  const currentDate = new Date().toISOString().slice(0, 10);
  const resolveOpenAIModel = (m?: string) => {
    const id = (m ?? DEFAULT_MODEL_ID).replace(/^openai:/, "");
    return openai.chat(id);
  };
  return new Agent<object, RegisteredTools>(components.agent, {
    name: options?.name ?? DEFAULT_NAME,
    languageModel: resolveOpenAIModel(options?.model),
    instructions: options?.instructions ?? buildDefaultInstructions(currentDate),
    tools: agentTools,
    stopWhen: stepCountIs(10),
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
