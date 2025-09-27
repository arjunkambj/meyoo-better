import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
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
    "Use available tools when they can improve accuracy, and prefer ISO 8601 date formatting in replies.",
    "Do not write or show code or API calls unless explicitly requested; prefer plain language answers.",
    "Use the provided Convex tools (ordersSummary, inventoryLowStock, analyticsSummary, pnlSnapshot, brandSummary, productsInventory, orgMembers, sendEmail) instead of ad-hoc calculations when possible.",
    "Before invoking the sendEmail tool, confirm the exact recipient address and desired content with the user. Use previewOnly when the user wants to review the email before it is sent.",
  ].join(" ");

export function createAgent(): Agent<object, RegisteredTools> {
  const currentDate = new Date().toISOString().slice(0, 10);
  return new Agent<object, RegisteredTools>(components.agent, {
    name: DEFAULT_NAME,
    languageModel: openai.chat(DEFAULT_MODEL_ID),
    instructions: buildDefaultInstructions(currentDate),
    tools: agentTools,
    maxSteps: 10,
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
