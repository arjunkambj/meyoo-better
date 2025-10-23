import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/libs/convexApi";
import type { AgentUIMessage } from "@repo/types/ui/agent";

export type { AgentUIMessage, UIMessagePart } from "@repo/types/ui/agent";

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

export function useAgent({
  threadId,
  threadPageSize = DEFAULT_THREAD_PAGE_SIZE,
  messagePageSize = DEFAULT_MESSAGE_PAGE_SIZE,
}: {
  threadId?: string;
  threadPageSize?: number;
  messagePageSize?: number;
} = {}) {
  const authToken = useAuthToken();
  const isAuthenticated = authToken !== null;

  const threadPagination = usePaginatedQuery(
    api.agent.chat.listThreads,
    isAuthenticated ? {} : "skip",
    {
      initialNumItems: threadPageSize,
    },
  );

  const messageArgs = threadId && isAuthenticated ? { threadId } : "skip";

  const messageUIMsgs = useUIMessages(
    api.agent.chat.listMessages,
    messageArgs,
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
  const messages = messageUIMsgs?.results as AgentUIMessage[] | undefined;

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
