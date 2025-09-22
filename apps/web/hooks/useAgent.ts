import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import type { UIMessage } from "ai";
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
  model?: string;
};

const DEFAULT_THREAD_PAGE_SIZE = 25;
const DEFAULT_MESSAGE_PAGE_SIZE = 40;

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

  const messagePagination = usePaginatedQuery(
    api.agent.chat.listMessages,
    threadId ? { threadId } : "skip",
    threadId
      ? {
          initialNumItems: messagePageSize,
        }
      : undefined,
  );

  const renameThreadMutation = useMutation(api.agent.chat.renameThread);
  const sendMessageAction = useAction(api.agent.action.sendMessage);
  const deleteThreadAction = useAction(api.agent.action.deleteThread);

  const [isSending, setIsSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<
    | undefined
    | {
        threadId: string;
        response: string;
        savedMessageIds: string[];
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        };
      }
  >(undefined);

  const threads = threadPagination.results as AgentThread[] | undefined;
  const messages = (messagePagination?.results ?? []) as UIMessage[] | undefined;

  const sendMessage = useCallback(
    async ({ message, threadId: existingThreadId, title, system, model }: SendAgentMessageArgs) => {
      setIsSending(true);
      try {
        const result = await sendMessageAction({
          message,
          threadId: existingThreadId,
          options: {
            title,
            system,
            model,
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
      loadMoreMessages: messagePagination?.loadMore,
      messagesStatus: messagePagination?.status,
      isLoadingMessages: messagePagination?.isLoading ?? false,
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
      messagePagination?.loadMore,
      messagePagination?.status,
      messagePagination?.isLoading,
      threadId,
      sendMessage,
      isSending,
      lastSendResult,
      renameThread,
      deleteThread,
    ],
  );
}
