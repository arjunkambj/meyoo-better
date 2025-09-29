import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, useTheme } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';

import {
  type AgentThread,
  type AgentUIMessage,
  DEFAULT_MESSAGE_PAGE_SIZE,
  DEFAULT_THREAD_PAGE_SIZE,
  useAgent,
} from '@/hooks/useAgent';
import { AgentChatComposer } from './AgentChatComposer';
import { AgentMessageFeed } from './AgentMessageFeed';
import { AgentThreadList } from './AgentThreadList';

const keyboardOffset = Platform.select({ ios: 96, android: 0, default: 0 });

export function AgentPanel() {
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat');
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState('');
  const [localMessages, setLocalMessages] = useState<AgentUIMessage[]>([]);
  const { colors } = useTheme();

  const {
    threads,
    messages,
    isLoadingThreads,
    isLoadingMessages,
    threadsStatus,
    messagesStatus,
    loadMoreThreads,
    loadMoreMessages,
    renameThread,
    deleteThread,
    sendMessage,
    isSending,
  } = useAgent({ threadId: activeThreadId });

  const messageScrollRef = useRef<ScrollView | null>(null);

  const handleScrollViewReady = useCallback((node: ScrollView | null) => {
    messageScrollRef.current = node;
  }, []);

  const displayedMessages = useMemo(() => {
    if (messages && messages.length > 0) {
      return messages;
    }
    return localMessages;
  }, [messages, localMessages]);

  const activeThread = useMemo(() => {
    if (!activeThreadId || !threads) return null;
    return threads.find(t => t.threadId === activeThreadId);
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (localMessages.length > 0 && (messages?.length ?? 0) > 0) {
      setLocalMessages([]);
    }
  }, [localMessages.length, messages?.length]);

  useEffect(() => {
    const scrollView = messageScrollRef.current;
    if (!scrollView) return;
    if (displayedMessages.length === 0) return;
    requestAnimationFrame(() => {
      scrollView.scrollToEnd({ animated: true });
    });
  }, [displayedMessages.length]);

  const startNewThread = useCallback(() => {
    setActiveThreadId(undefined);
    setLocalMessages([]);
    setViewMode('chat');
  }, []);

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setLocalMessages([]);
    setViewMode('chat');
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setInputValue('');

    const now = Date.now();
    const userMessage: AgentUIMessage = {
      id: `local-user-${now}`,
      role: 'user',
      text: trimmed,
    };
    const thinkingMessage: AgentUIMessage = {
      id: `local-assistant-${now}`,
      role: 'assistant',
      text: '__thinking__',
    };

    setLocalMessages((prev) => [...prev, userMessage, thinkingMessage]);

    try {
      const result = await sendMessage({
        message: trimmed,
        threadId: activeThreadId,
        title: trimmed.slice(0, 40),
      });
      if (!activeThreadId && result?.threadId) {
        setActiveThreadId(result.threadId);
      }
    } catch (error) {
      setLocalMessages((prev) => prev.filter((msg) => !msg.id.startsWith('local-')));
      setInputValue(trimmed);
      console.error('Failed to send agent message', error);
    }
  }, [activeThreadId, inputValue, sendMessage]);

  const handleRenameThread = useCallback(
    async (threadId: string, nextTitle: string) => {
      await renameThread({ threadId, title: nextTitle });
    },
    [renameThread],
  );

  const handleDeleteThread = useCallback(
    (thread: AgentThread) => {
      Alert.alert(
        'Delete conversation',
        thread.title
          ? `Delete "${thread.title}"? This cannot be undone.`
          : 'Delete this conversation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteThread(thread.threadId);
                if (activeThreadId === thread.threadId) {
                  startNewThread();
                }
              } catch (error) {
                console.error('Failed to delete agent thread', error);
              }
            },
          },
        ],
      );
    },
    [activeThreadId, deleteThread, startNewThread],
  );

  const canLoadMoreThreads = threadsStatus === 'CanLoadMore';
  const loadingMoreThreads = threadsStatus === 'LoadingMore';
  const canLoadMoreMessages = messagesStatus === 'CanLoadMore';
  const loadingMoreMessages = messagesStatus === 'LoadingMore';
  const showEmptyMessages = displayedMessages.length === 0 && !isLoadingMessages;
  const isInitialMessagesLoading = isLoadingMessages && (messages?.length ?? 0) === 0;

  const handleLoadMoreThreads = useCallback(() => {
    loadMoreThreads?.(DEFAULT_THREAD_PAGE_SIZE);
  }, [loadMoreThreads]);

  const handleLoadMoreMessages = useCallback(() => {
    loadMoreMessages?.(DEFAULT_MESSAGE_PAGE_SIZE);
  }, [loadMoreMessages]);

  return (
    <View className="flex-1 bg-background">
      {viewMode === 'history' ? (
        <View className="flex-1">
          {/* History Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40 bg-surface-2">
            <View className="flex-row items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setViewMode('chat')}
                className="h-9 w-9"
              >
                <Ionicons name="arrow-back" size={20} color={colors.foreground} />
              </Button>
              <Text className="text-lg font-semibold text-foreground">Conversations</Text>
            </View>
            <Button
              size="sm"
              variant="primary"
              className="rounded-full h-9"
              onPress={startNewThread}
            >
              <Button.StartContent>
                <Ionicons name="add" size={18} color={colors.accentForeground} />
              </Button.StartContent>
              <Button.LabelContent>New</Button.LabelContent>
            </Button>
          </View>

          {/* Thread List */}
          <AgentThreadList
            threads={threads}
            isLoading={isLoadingThreads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onRenameThread={handleRenameThread}
            onDeleteThread={handleDeleteThread}
            canLoadMore={canLoadMoreThreads}
            onLoadMore={canLoadMoreThreads ? handleLoadMoreThreads : undefined}
            loadingMore={loadingMoreThreads}
          />
        </View>
      ) : (
        <View className="flex-1">
          {/* Chat Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40 bg-surface-2">
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {activeThread?.title || 'New Chat'}
              </Text>
              {displayedMessages.length > 0 && (
                <Text className="text-xs text-default-500">
                  {displayedMessages.length} {displayedMessages.length === 1 ? 'message' : 'messages'}
                </Text>
              )}
            </View>
            <View className="flex-row gap-2">
              {activeThreadId && (
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  onPress={startNewThread}
                  className="h-9 w-9"
                >
                  <Ionicons name="create-outline" size={20} color={colors.foreground} />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setViewMode('history')}
                className="h-9 w-9"
              >
                <Ionicons name="time-outline" size={20} color={colors.foreground} />
              </Button>
            </View>
          </View>

          {/* Messages */}
          <AgentMessageFeed
            onScrollViewReady={handleScrollViewReady}
            messages={displayedMessages}
            showEmpty={showEmptyMessages}
            isInitialLoading={isInitialMessagesLoading}
            canLoadMore={canLoadMoreMessages}
            loadingMore={loadingMoreMessages}
            onLoadMore={canLoadMoreMessages ? handleLoadMoreMessages : undefined}
          />

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={keyboardOffset}
          >
            <View className="px-4 pb-4 pt-3 border-t border-border/40 bg-surface-2">
              <AgentChatComposer
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                loading={isSending}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}