import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Skeleton, Spinner } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAgent, type AgentUIMessage } from '@/hooks/useAgent';

function MessageBubble({ message }: { message: AgentUIMessage }) {
  const isUser = message.role === 'user';

  return (
    <View
      className={`flex-row ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <View
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-primary rounded-br-md'
            : 'bg-surface-2 rounded-bl-md'
        }`}
      >
        <Text
          className={`text-sm ${
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
  const inputRef = useRef<TextInput>(null);

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const threadId = params.threadId;

  const {
    messages,
    isLoadingMessages,
    sendMessage,
    isSending,
    messagesStatus,
    loadMoreMessages,
  } = useAgent({ threadId });

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setMessage('');
    setIsTyping(true);

    try {
      const result = await sendMessage({
        message: trimmed,
        threadId,
        title: trimmed.slice(0, 40),
      });

      // If this was a new chat, update URL with the new thread ID
      if (!threadId && result?.threadId) {
        router.setParams({ threadId: result.threadId });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessage(trimmed); // Restore message on error
    } finally {
      setIsTyping(false);
    }
  }, [message, isSending, sendMessage, threadId, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleLoadMore = useCallback(() => {
    if (messagesStatus === 'CanLoadMore') {
      loadMoreMessages?.(30);
    }
  }, [messagesStatus, loadMoreMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages?.length && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length]);

  const canLoadMore = messagesStatus === 'CanLoadMore';
  const isLoadingMore = messagesStatus === 'LoadingMore';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-default-100">
        <TouchableOpacity onPress={handleBack} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
        <View className="flex-1 ml-3">
          <Text className="text-lg font-semibold text-foreground">
            Meyoo Agent
          </Text>
          <Text className="text-xs text-default-500">
            {threadId ? 'Conversation' : 'New Chat'}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {isSending && <Spinner size="sm" />}
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
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

        {isLoadingMessages && (!messages || messages.length === 0) ? (
          <View className="gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-16 rounded-2xl ${
                  i % 2 === 0 ? 'self-start w-3/4' : 'self-end w-2/3'
                }`}
              />
            ))}
          </View>
        ) : !messages || messages.length === 0 ? (
          <Card surfaceVariant="1" className="mt-8">
            <Card.Body className="items-center py-6">
              <View className="items-center gap-3">
                <View className="h-12 w-12 rounded-full bg-primary-100 items-center justify-center">
                  <Ionicons name="sparkles" size={24} color="#6366f1" />
                </View>
                <Card.Title>Start a Conversation</Card.Title>
                <Card.Description className="text-center px-4">
                  Ask about your Shopify data, marketing campaigns, sync status, or anything else you need help with.
                </Card.Description>
              </View>
            </Card.Body>
          </Card>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && (
              <View className="flex-row justify-start mb-3">
                <View className="bg-surface-2 px-4 py-3 rounded-2xl rounded-bl-md">
                  <View className="flex-row gap-1">
                    <View className="w-2 h-2 bg-default-400 rounded-full animate-pulse" />
                    <View className="w-2 h-2 bg-default-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <View className="w-2 h-2 bg-default-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View className="px-4 py-3 border-t border-default-100">
          <View className="flex-row items-end gap-2">
            <View className="flex-1 min-h-[44px] max-h-[120px] bg-surface-1 rounded-2xl px-4 py-2">
              <TextInput
                ref={inputRef}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
                className="text-foreground text-base"
                style={{ minHeight: 28, maxHeight: 100 }}
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!message.trim() || isSending}
              className={`h-11 w-11 rounded-full items-center justify-center ${
                message.trim() && !isSending
                  ? 'bg-primary'
                  : 'bg-default-200'
              }`}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={20}
                color={message.trim() && !isSending ? 'white' : '#999'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}