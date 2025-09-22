import { RAG } from "@convex-dev/rag";
import { components } from "./_generated/api";
import { openai } from "@ai-sdk/openai";

export type RagFilterTypes = {
  type: string;
  resourceId: string;
  timeBucket?: string;
};

export const rag = new RAG<RagFilterTypes>(components.rag, {
  filterNames: ["type", "resourceId", "timeBucket"],
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});
