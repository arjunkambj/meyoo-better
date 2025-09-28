import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Divider } from 'heroui-native';

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
import { AgentTipCarousel, type AgentTip } from './AgentTipCarousel';

const AGENT_TIPS: AgentTip[] = [
  {
    title: 'Meyoo Agent knows your workspace',
    description:
      'Ask about Shopify imports, marketing syncs, and data issues. Threads persist across devices.',
  },
  {
    title: 'Use threads to keep topics tidy',
    description:
      'Start a new chat for each workflow so you can revisit previous answers without losing context.',
  },
  {
    title: 'Coming soon: on-device actions',
    description:
      'Mobile will soon support retrying syncs and scheduling follow-ups directly from the assistant.',
  },
];

const keyboardOffset = Platform.select({ ios: 96, android: 0, default: 0 });

export function AgentPanel() {
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat');
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(undefined);
  const [inputValue, setInputValue] = useState('');
  const [localMessages, setLocalMessages] = useState<AgentUIMessage[]>([]);

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
    <View className="flex-1 gap-6">
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-default-500">
              Meyoo Agent
            </Text>
            <Text className="text-2xl font-semibold text-foreground">
              Ask questions, review syncs, and plan next steps.
            </Text>
          </View>
          <Button
            size="sm"
            variant="secondary"
            className="rounded-lg"
            onPress={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
          >
            {viewMode === 'chat' ? 'History' : 'Back'}
          </Button>
        </View>
        <Text className="text-sm leading-5 text-default-500">
          Threads sync with the web dashboard so you can start a conversation here and finish it on desktop.
        </Text>
      </View>

      <AgentTipCarousel tips={AGENT_TIPS} />

      {viewMode === 'history' ? (
        <View className="flex-1 rounded-3xl border border-default-100 bg-content1 p-4 gap-3">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm font-semibold text-default-600">Conversations</Text>
            <Button size="sm" variant="secondary" className="rounded-lg" onPress={startNewThread}>
              New chat
            </Button>
          </View>
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
        <View className="flex-1 rounded-3xl border border-default-100 bg-content1">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-sm font-semibold text-default-600">
              {activeThreadId ? 'Conversation' : 'New conversation'}
            </Text>
            <Chip size="sm" className="rounded-full">
              {isLoadingMessages
                ? 'Syncing'
                : `${displayedMessages.length} message${displayedMessages.length === 1 ? '' : 's'}`}
            </Chip>
          </View>
          <Divider className="opacity-60" />

          <AgentMessageFeed
            onScrollViewReady={handleScrollViewReady}
            messages={displayedMessages}
            showEmpty={showEmptyMessages}
            isInitialLoading={isInitialMessagesLoading}
            canLoadMore={canLoadMoreMessages}
            loadingMore={loadingMoreMessages}
            onLoadMore={canLoadMoreMessages ? handleLoadMoreMessages : undefined}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={keyboardOffset}
          >
            <View className="px-4 pb-5">
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
