import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/libs/convexApi";

export type AgentThread = {
  threadId: string;
  title?: string;
  summary?: string;
  status: "active" | "archived";
  createdAt: number;
};

export type SendAgentMessageArgs = {
  threadId?: string;
  message: string;
  title?: string;
  system?: string;
};

const DEFAULT_THREAD_PAGE_SIZE = 25;
const DEFAULT_MESSAGE_PAGE_SIZE = 40;

export type UIMessagePart = {
  type: string;
  toolName?: string;
  name?: string;
  tool?: string;
  [key: string]: unknown;
};

export type AgentUIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  status?: string; // e.g. "streaming" or success
  parts?: UIMessagePart[]; // optional UI parts for tool/status awareness
};

export function useAgent({
  threadId,
  threadPageSize = DEFAULT_THREAD_PAGE_SIZE,
  messagePageSize = DEFAULT_MESSAGE_PAGE_SIZE,
}: {
  threadId?: string;
  threadPageSize?: number;
  messagePageSize?: number;
} = {}) {
  const threadPagination = usePaginatedQuery(
    api.agent.chat.listThreads,
    {},
    {
      initialNumItems: threadPageSize,
    },
  );

  const messageUIMsgs = useUIMessages(
    api.agent.chat.listMessages as any,
    threadId ? { threadId } : ("skip" as any),
    { initialNumItems: messagePageSize, stream: true },
  );

  const renameThreadMutation = useMutation(api.agent.chat.renameThread);
  const sendMessageAction = useAction(api.agent.action.sendMessage);
  const deleteThreadAction = useAction(api.agent.action.deleteThread);

  const [isSending, setIsSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<
    | undefined
    | {
        threadId: string;
        savedMessageIds: string[];
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        };
      }
  >(undefined);

  const threads = threadPagination.results as AgentThread[] | undefined;
  const messages = (messageUIMsgs?.results ?? []) as unknown as AgentUIMessage[] | undefined;

  const sendMessage = useCallback(
    async ({ message, threadId: existingThreadId, title, system }: SendAgentMessageArgs) => {
      setIsSending(true);
      try {
        const result = await sendMessageAction({
          message,
          threadId: existingThreadId,
          options: {
            title,
            system,
          },
        });
        setLastSendResult(result);
        return result;
      } finally {
        setIsSending(false);
      }
    },
    [sendMessageAction],
  );

  const renameThread = useCallback(
    async (params: { threadId: string; title: string }) => {
      return renameThreadMutation(params);
    },
    [renameThreadMutation],
  );

  const deleteThread = useCallback(
    async (threadIdToDelete: string) => {
      await deleteThreadAction({ threadId: threadIdToDelete });
    },
    [deleteThreadAction],
  );

  return useMemo(
    () => ({
      threads,
      loadMoreThreads: threadPagination.loadMore,
      threadsStatus: threadPagination.status,
      isLoadingThreads: threadPagination.isLoading,
      messages: threadId ? messages : undefined,
      loadMoreMessages: messageUIMsgs?.loadMore,
      messagesStatus: messageUIMsgs?.status,
      isLoadingMessages: messageUIMsgs?.status === "LoadingFirstPage",
      sendMessage,
      isSending,
      lastSendResult,
      renameThread,
      deleteThread,
    }),
    [
      threadPagination.loadMore,
      threadPagination.status,
      threadPagination.isLoading,
      threads,
      messages,
      messageUIMsgs?.loadMore,
      messageUIMsgs?.status,
      threadId,
      sendMessage,
      isSending,
      lastSendResult,
      renameThread,
      deleteThread,
    ],
  );
}
