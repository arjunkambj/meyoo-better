"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Divider, Select, SelectItem } from "@heroui/react";
import AgentChatInput from "@/components/agent/components/AgentChatInput";
import NewChatButton from "@/components/agent/components/NewChatButton";
import type { ChatItem } from "@/components/agent/components/ChatHistory";
import AssistantMessage from "@/components/agent/components/AssistantMessage";
import UserMessage from "@/components/agent/components/UserMessage";
import { nanoid } from "nanoid";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ChatItem[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const models = useMemo(
    () => [
      {
        value: "gpt-5-fast",
        label: "gpt-5 fast",
      },
    ],
    []
  );

  const startNewChat = useCallback(() => {
    // Prepare a new chat session without adding it to history yet.
    // We only add to history upon first message send.
    const id = nanoid(8);
    setActiveId(id);
    setMessages([]);
  }, []);

  const onSelectConversation = useCallback((id: string) => {
    setActiveId(id);
    // In a real app, load messages for that conversation.
    setMessages([]);
  }, []);

  const handleSend = useCallback(
    async (message: string, model: string) => {
      // Ensure we have a chat id; if none, start one now but don't add to history until below.
      const chatId = activeId ?? nanoid(8);
      if (!activeId) setActiveId(chatId);

      const userMsg: Message = {
        id: nanoid(6),
        role: "user",
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Simulated assistant echo. Wire up to backend later.
      const assistantMsg: Message = {
        id: nanoid(6),
        role: "assistant",
        content: message,
      };
      setTimeout(() => setMessages((prev) => [...prev, assistantMsg]), 250);

      // Add to history if not present, otherwise update placeholder title.
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === chatId);
        if (!exists) {
          return [{ id: chatId, title: message.slice(0, 32) }, ...prev].slice(0, 10);
        }
        return prev.map((c) =>
          c.id === chatId && (c.title === "New chat" || !c.title)
            ? { ...c, title: message.slice(0, 32) }
            : c
        );
      });
    },
    [activeId]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 pt-2 pb-1 flex items-center gap-2">
        <div className="text-sm font-medium truncate flex-1">AI Assistant</div>
        <Select
          aria-label="Chat history"
          size="sm"
          placeholder="History"
          className="min-w-28 max-w-44"
          selectedKeys={activeId ? new Set([activeId]) : new Set([])}
          onSelectionChange={(keys) => {
            const id = Array.from(keys)[0]?.toString();
            if (id) onSelectConversation(id);
          }}
        >
          {conversations.length === 0 ? (
            <SelectItem key="_empty" isDisabled>
              No history
            </SelectItem>
          ) : (
            conversations.map((c) => (
              <SelectItem key={c.id} textValue={c.title}>
                {c.title}
              </SelectItem>
            ))
          )}
        </Select>
        <NewChatButton onNew={startNewChat} />
      </div>
      <Divider className="my-1" />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-2">
        {messages.length === 0 ? (
          <div className="pt-2 text-default-500 text-xs">
            Say hello to start chatting.
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((m) =>
              m.role === "assistant" ? (
                <AssistantMessage key={m.id} content={m.content} onVote={(v) => console.log("vote", v)} />
              ) : (
                <UserMessage key={m.id} content={m.content} />
              )
            )}
          </div>
        )}
      </div>
      <div className="border-t border-default-100 p-1">
        <AgentChatInput
          models={models}
          defaultModel={models[0]?.value}
          onSend={handleSend}
          showModelSelector={false}
        />
      </div>
    </div>
  );
}
