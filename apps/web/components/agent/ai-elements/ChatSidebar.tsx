"use client";

import { useState } from "react";
import { cn } from "@/libs/utils";
import { Icon } from "@iconify/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputAttachments,
  type PromptInputMessage,
} from "./prompt-input";
import ChatMessage from "./ChatMessage";
import ChatHistory from "./ChatHistory";
import NewChatButton from "./NewChatButton";
import SearchBar from "./SearchBar";
import LoadingIndicator from "./LoadingIndicator";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

interface ChatSidebarProps {
  className?: string;
}

export default function ChatSidebar({ className }: ChatSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const currentChat = chats.find((chat) => chat.id === activeChat);
  const messages = currentChat?.messages || [];

  const filteredChats = searchQuery
    ? chats.filter(
        (chat) =>
          chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats;

  const handleNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat: Chat = {
      id: newChatId,
      title: "New Conversation",
      lastMessage: "",
      timestamp: new Date(),
      messages: [],
    };
    setChats([newChat, ...chats]);
    setActiveChat(newChatId);
    setShowHistory(false);
  };

  const handleSendMessage = (message: PromptInputMessage) => {
    const content = message.text?.trim();
    if (!content) return;

    if (!activeChat) {
      handleNewChat();
      setTimeout(() => handleSendMessage(message), 0);
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id === activeChat) {
          const updatedMessages = [...chat.messages, newMessage];
          return {
            ...chat,
            messages: updatedMessages,
            lastMessage: content,
            timestamp: new Date(),
            title: chat.messages.length === 0 ? content.slice(0, 30) + "..." : chat.title,
          };
        }
        return chat;
      })
    );

    setIsLoading(true);
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm here to help! This is a placeholder response. Integration with AI services will be added soon.",
        timestamp: new Date(),
      };

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id === activeChat) {
            return {
              ...chat,
              messages: [...chat.messages, assistantMessage],
              lastMessage: assistantMessage.content.slice(0, 50) + "...",
              timestamp: new Date(),
            };
          }
          return chat;
        })
      );
      setIsLoading(false);
    }, 1000);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    setShowHistory(false);
  };

  const handleDeleteChat = (chatId: string) => {
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    if (activeChat === chatId) {
      setActiveChat(null);
    }
  };


  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-default-100">
        <div className="flex items-center gap-2">
          {(activeChat || chats.length > 0) && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                "hover:bg-default-100",
                "text-default-600"
              )}
              title={showHistory ? "View current chat" : "View chat history"}
            >
              <Icon
                icon={showHistory ? "solar:chat-round-dots-linear" : "solar:list-linear"}
                width={20}
              />
            </button>
          )}
          <span className="font-medium text-default-900">
            {showHistory ? "Chat History" : (currentChat ? currentChat.title : "New Chat")}
          </span>
        </div>
        <NewChatButton onClick={handleNewChat} className="py-1.5 px-2.5 text-xs" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showHistory ? (
          <div className="flex flex-col w-full">
            <div className="px-6 pt-3 pb-3">
              <SearchBar onSearch={setSearchQuery} />
            </div>
            <ChatHistory
              chats={filteredChats}
              activeId={activeChat || undefined}
              onSelectChat={handleSelectChat}
              onDeleteChat={handleDeleteChat}
              className="flex-1"
            />
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-xs">
                  <Icon
                    icon="solar:magic-stick-3-bold-duotone"
                    width={48}
                    className="mx-auto mb-4 text-default-300"
                  />
                  <h3 className="text-sm font-medium text-default-700 mb-1">
                    Start a conversation
                  </h3>
                  <p className="text-xs text-default-500">
                    Ask me anything about your business data and analytics
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="pb-4">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      timestamp={message.timestamp}
                    />
                  ))}
                  {isLoading && (
                    <div className="px-4 py-3">
                      <LoadingIndicator type="typing" />
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            <PromptInput
              onSubmit={handleSendMessage}
              className="border-t border-default-100 mx-4 mb-4 rounded-xl"
            >
              <PromptInputBody>
                <PromptInputAttachments>
                  {(attachment) => (
                    <div key={attachment.id} className="p-2 border rounded">
                      {attachment.filename}
                    </div>
                  )}
                </PromptInputAttachments>
                <PromptInputTextarea
                  name="message"
                  placeholder="Type a message..."
                  disabled={isLoading}
                  className="min-h-[60px] max-h-[120px] resize-none border-0 bg-transparent px-4 py-3 focus-visible:ring-0"
                />
              </PromptInputBody>
              <PromptInputToolbar>
                <PromptInputTools />
                <PromptInputSubmit disabled={isLoading} />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        )}
      </div>
    </div>
  );
}