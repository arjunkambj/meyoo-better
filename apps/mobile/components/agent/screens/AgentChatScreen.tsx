import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAgent, type AgentUIMessage } from '@/hooks/useAgent';
import { inferAgentThinkingLabel, useOptimisticAgentMessages } from '@repo/ui/agent/useOptimisticAgentMessages';

function MessageBubble({ message }: { message: AgentUIMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      className={`flex-row ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <View
        className={`max-w-[85%] px-4 py-3 rounded-3xl ${
          isUser
            ? 'bg-primary rounded-br-md'
            : 'bg-surface-2 rounded-bl-md'
        }`}
      >
        <Text
          className={`text-base leading-6 ${
            isUser ? 'text-white' : 'text-foreground'
          }`}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

export function AgentChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const normalizedThreadId = Array.isArray(params.threadId)
    ? params.threadId[0]
    : params.threadId;
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(
    typeof normalizedThreadId === 'string' && normalizedThreadId.length > 0
      ? normalizedThreadId
      : undefined,
  );

  const {
    messages,
    isLoadingMessages,
    messagesStatus,
    loadMoreMessages,
    sendMessage,
    isSending,
  } = useAgent({ threadId: activeThreadId });

  const {
    displayedMessages: optimisticMessages,
    appendSequence,
    markSequenceSaved,
    removeSequence,
    reset: resetOptimisticMessages,
  } = useOptimisticAgentMessages(messages);

  useEffect(() => {
    const nextThreadId =
      typeof normalizedThreadId === 'string' && normalizedThreadId.length > 0
        ? normalizedThreadId
        : undefined;

    setActiveThreadId((previous) => {
      if (previous === nextThreadId) {
        return previous;
      }

      resetOptimisticMessages();
      return nextThreadId;
    });
  }, [normalizedThreadId, resetOptimisticMessages]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNewChat = useCallback(() => {
    resetOptimisticMessages();
    setActiveThreadId(undefined);

    if (typeof router.setParams === 'function') {
      router.setParams({ threadId: undefined });
    } else {
      router.replace('/agent');
    }
  }, [resetOptimisticMessages, router]);

  const handleOpenHistory = useCallback(() => {
    router.push('/agent/history');
  }, [router]);

  const handleLoadMore = useCallback(() => {
    if (messagesStatus === 'CanLoadMore') {
      loadMoreMessages?.(30);
    }
  }, [messagesStatus, loadMoreMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (optimisticMessages.length && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [optimisticMessages.length]);

  const canLoadMore = messagesStatus === 'CanLoadMore';
  const isLoadingMore = messagesStatus === 'LoadingMore';
  const showEmpty = optimisticMessages.length === 0 && !isLoadingMessages;

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userId = `local-u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const assistantId = `local-a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const pendingKey = appendSequence([
      { id: userId, role: 'user', text: trimmed, status: 'local' },
      { id: assistantId, role: 'assistant', text: '__thinking__', status: 'local' },
    ]);

    setDraft('');

    try {
      const response = await sendMessage({
        message: trimmed,
        threadId: activeThreadId,
        title: trimmed.slice(0, 32),
      });

      if (!activeThreadId && response?.threadId) {
        setActiveThreadId(response.threadId);

        if (typeof router.setParams === 'function') {
          router.setParams({ threadId: response.threadId });
        } else {
          router.replace({ pathname: '/agent', params: { threadId: response.threadId } });
        }
      }

      markSequenceSaved(pendingKey, response?.savedMessageIds ?? []);
    } catch (error) {
      console.error('Failed to send agent message', error);
      removeSequence(pendingKey);
      setDraft(trimmed);
    }
  }, [
    activeThreadId,
    appendSequence,
    draft,
    isSending,
    markSequenceSaved,
    removeSequence,
    router,
    sendMessage,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity
              onPress={handleBack}
              className="h-10 w-10 rounded-full bg-surface-2 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-1 mx-3" onPress={handleOpenHistory}>
              <View className="flex-row items-center justify-center gap-1">
                <Text className="text-lg font-semibold text-foreground">
                  Chat history
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNewChat}
              className="h-10 w-10 rounded-full bg-surface-2 items-center justify-center"
            >
              <Ionicons name="create-outline" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 16,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {canLoadMore && (
              <TouchableOpacity
                onPress={handleLoadMore}
                className="py-2 mb-4 items-center"
              >
                <Text className="text-sm text-primary">
                  {isLoadingMore ? 'Loading...' : 'Load earlier messages'}
                </Text>
              </TouchableOpacity>
            )}

            {showEmpty ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="text-base font-semibold text-foreground">
                  No messages yet.
                </Text>
                <Text className="text-sm text-default-500 text-center mt-2">
                  Messages from Meyoo Agent will appear here.
                </Text>
              </View>
            ) : (
              <>
                {optimisticMessages.map((msg) => {
                  const isAssistant = msg.role === 'assistant';
                  const trimmed = msg.text?.trim() ?? '';
                  const isStreaming = isAssistant && msg.status === 'streaming';
                  const isThinking = msg.text === '__thinking__' || (isStreaming && trimmed.length === 0);

                  if (isThinking) {
                    const label = inferAgentThinkingLabel(msg.parts ?? undefined);
                    return (
                      <View key={msg.id} className="flex-row justify-start mb-4">
                        <View className="bg-surface-2 px-4 py-3 rounded-3xl rounded-bl-md">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-default-500">{label}</Text>
                            <View className="flex-row gap-1.5">
                              <View className="w-2 h-2 bg-default-400 rounded-full animate-pulse" />
                              <View
                                className="w-2 h-2 bg-default-400 rounded-full animate-pulse"
                                style={{ animationDelay: '150ms' }}
                              />
                              <View
                                className="w-2 h-2 bg-default-400 rounded-full animate-pulse"
                                style={{ animationDelay: '300ms' }}
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return <MessageBubble key={msg.id} message={msg} />;
                })}
              </>
            )}
          </ScrollView>
        </View>

        {/* Composer */}
        <View
          className="border-t border-border bg-background px-4 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-end gap-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              multiline
              placeholder="Ask Meyoo Agent..."
              placeholderTextColor="#9CA3AF"
              editable={!isSending}
              className="flex-1 min-h-[44px] max-h-[120px] rounded-3xl bg-surface-2 px-4 py-3 text-base text-foreground"
              textAlignVertical="top"
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
              className={`h-12 w-12 items-center justify-center rounded-full ${
                !draft.trim() || isSending ? 'bg-default-200' : 'bg-primary'
              }`}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={!draft.trim() ? '#9CA3AF' : '#ffffff'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
