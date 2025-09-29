"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/react";
import AgentChatInput from "@/components/agent/components/AgentChatInput";
import NewChatButton from "@/components/agent/components/NewChatButton";
import AssistantMessage from "@/components/agent/components/AssistantMessage";
import UserMessage from "@/components/agent/components/UserMessage";
import {
  useAgent,
  type AgentUIMessage,
  type UIMessagePart,
} from "@/hooks/useAgent";
import { nanoid } from "nanoid";
import TypingMessage from "@/components/agent/components/TypingMessage";
import { Icon } from "@iconify/react";
import MessageSkeleton from "@/components/agent/components/MessageSkeleton";
import HistorySkeleton from "@/components/agent/components/HistorySkeleton";
import ChatHistoryItem from "@/components/agent/components/ChatHistoryItem";
import RenameThreadDialog from "@/components/agent/components/RenameThreadDialog";
import ThinkingSpinnerAlt from "@/components/agent/components/ThinkingSpinnerAlt";

export default function ChatUI() {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"chat" | "history">("chat");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    threads,
    messages,
    isLoadingMessages,
    isLoadingThreads,
    isSending,
    sendMessage,
    renameThread,
    deleteThread,
  } = useAgent({ threadId: activeId });

  // Local optimistic messages shown immediately while waiting for server.
  const [localMessages, setLocalMessages] = useState<
    { id: string; role: "user" | "assistant"; text: string }[]
  >([]);

  const startNewChat = useCallback(() => {
    // Clear active thread; first send will create a new one
    setActiveId(undefined);
    setViewMode("chat");
  }, []);

  const onSelectConversation = useCallback((id: string) => {
    setActiveId(id);
    setViewMode("chat");
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      // If currently viewing history, switch to chat when sending
      setViewMode("chat");
      // Add optimistic user message and a temporary assistant thinking bubble
      const userId = `local-u-${nanoid(6)}`;
      const thinkingId = `local-a-${nanoid(6)}`;
      setLocalMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text: message },
        { id: thinkingId, role: "assistant", text: "__thinking__" },
      ]);

      try {
        const res = await sendMessage({
          message,
          threadId: activeId,
          title: message.slice(0, 32),
        });
        if (!activeId && res?.threadId) {
          setActiveId(res.threadId);
        }
      } finally {
        // Clear handled via effect when server messages hydrate
      }
    },
    [activeId, sendMessage]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length, localMessages.length]);

  const displayedMessages: AgentUIMessage[] = useMemo(() => {
    if (messages && messages.length > 0) return messages as AgentUIMessage[];
    return localMessages as unknown as AgentUIMessage[];
  }, [messages, localMessages]);

  // Clear optimistic messages once server messages are present to avoid first-render blink
  useEffect(() => {
    if (localMessages.length > 0 && (messages?.length ?? 0) > 0) {
      setLocalMessages([]);
    }
  }, [messages?.length, localMessages.length]);

  const conversationOptions = useMemo(() => {
    return (threads ?? []).map((t) => ({
      id: t.threadId,
      title: t.title ?? "New chat",
    }));
  }, [threads]);

  const isNewChat = !activeId;
  const showLoadingSkeleton = !!activeId && isLoadingMessages;

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 py-3 flex items-center gap-2 border-b border-default-200">
        <Button
          size="sm"
          variant="flat"
          isIconOnly
          radius="lg"
          startContent={
            <Icon
              icon={
                viewMode === "chat"
                  ? "solar:hamburger-menu-bold"
                  : "solar:alt-arrow-left-line-duotone"
              }
              width={20}
            />
          }
          aria-label={
            viewMode === "chat" ? "Open chat history" : "Back to chat"
          }
          title={viewMode === "chat" ? "View History" : "Back to Chat"}
          onPress={() => setViewMode(viewMode === "chat" ? "history" : "chat")}
          className="hover:bg-default-200 transition-colors text-default-700"
        >
          {viewMode === "chat" ? "" : ""}
        </Button>

        <div className="flex-1" />

        <NewChatButton onNew={startNewChat} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-3">
        {viewMode === "history" ? (
          isLoadingThreads ? (
            <HistorySkeleton />
          ) : conversationOptions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div className="max-w-xs">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Icon
                      icon="solar:inbox-line-bold-duotone"
                      width={32}
                      className="text-primary/60"
                    />
                  </div>
                </div>
                <div className="text-base font-semibold text-default-900 mb-1.5">
                  No conversations yet
                </div>
                <div className="text-sm text-default-500 leading-relaxed">
                  Start a new chat to see it here
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 pt-3">
              {conversationOptions.map((c) => (
                <ChatHistoryItem
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  active={c.id === activeId}
                  onSelect={onSelectConversation}
                  onRename={(id) => {
                    setRenameTarget({ id, title: c.title });
                    setRenameOpen(true);
                  }}
                  onDelete={async (id) => {
                    // handled below via useAgent deleteThread
                    await deleteThread(id);
                    if (activeId === id) setActiveId(undefined);
                  }}
                />
              ))}
            </div>
          )
        ) : !displayedMessages || displayedMessages.length === 0 ? (
          showLoadingSkeleton ? (
            <MessageSkeleton rows={4} />
          ) : (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div className="max-w-sm">
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Icon
                      icon="solar:magic-stick-3-bold-duotone"
                      width={32}
                      className="text-primary"
                    />
                  </div>
                </div>
                <div className="text-base font-semibold text-default-900 mb-2">
                  {isNewChat ? "How can I help you today?" : "Start the conversation"}
                </div>
                <div className="text-sm text-default-500 leading-relaxed">
                  {isNewChat
                    ? "Ask about your store's data, inventory, orders, or ad performance"
                    : "Send a message to begin"}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2 pt-2">
            {displayedMessages.map((m) => {
              if (m.role === "assistant") {
                const streaming = m.status === "streaming";
                const text = m.text ?? "";
                const parts = (m.parts ?? []) as UIMessagePart[];

                if (text.trim().length === 0 && streaming) {
                  // Try to infer tool activity label from parts
                  const toolName = (() => {
                    const toolPart = parts.find(
                      (p) =>
                        p &&
                        p.type &&
                        (p.type === "tool" || p.type === "step-start")
                    ) as UIMessagePart | undefined;
                    const rawName = toolPart
                      ? (toolPart.toolName ?? toolPart.name ?? toolPart.tool)
                      : undefined;
                    const name = typeof rawName === "string" ? rawName : "";
                    const n = name.toLowerCase();
                    if (n.includes("inventory"))
                      return "Reading inventory details…";
                    if (n.includes("meta") || n.includes("ads"))
                      return "Reading meta analytics…";
                    if (n.includes("order")) return "Summarizing orders…";
                    if (n.includes("brand")) return "Fetching brand summary…";
                    return "Thinking…";
                  })();
                  return <ThinkingSpinnerAlt key={m.id} label={toolName} />;
                }

                if (text === "__thinking__") {
                  return <TypingMessage key={m.id} />;
                }

                return (
                  <AssistantMessage
                    key={m.id}
                    content={text}
                    streaming={streaming}
                    onVote={(v) => console.log("vote", v)}
                  />
                );
              }
              return <UserMessage key={m.id} content={m.text} />;
            })}
          </div>
        )}
      </div>
      <div className="px-3 pt-3 pb-2">
        <AgentChatInput onSend={handleSend} busy={isSending} />
      </div>
      <RenameThreadDialog
        isOpen={renameOpen}
        initialTitle={renameTarget?.title}
        onClose={() => setRenameOpen(false)}
        onConfirm={async (nextTitle) => {
          if (!renameTarget) return;
          await renameThread({ threadId: renameTarget.id, title: nextTitle });
        }}
      />
    </div>
  );
}
