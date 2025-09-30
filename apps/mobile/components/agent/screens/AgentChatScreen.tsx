import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const params = useLocalSearchParams<{ threadId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);

  const threadId = params.threadId;

  const {
    messages,
    isLoadingMessages,
    messagesStatus,
    loadMoreMessages,
  } = useAgent({ threadId });

  const {
    displayedMessages: optimisticMessages,
    reset: resetOptimisticMessages,
  } = useOptimisticAgentMessages(messages);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNewChat = useCallback(() => {
    resetOptimisticMessages();
    router.push('/agent');
  }, [resetOptimisticMessages, router]);

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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity
          onPress={handleBack}
          className="h-10 w-10 rounded-full bg-surface-2 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity className="flex-1 mx-3">
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-lg font-semibold text-foreground">
              {threadId ? 'Conversation' : 'New conversation'}
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
          padding: 16,
          paddingBottom: 8,
        }}
        keyboardShouldPersistTaps="handled"
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
    </SafeAreaView>
  );
}
