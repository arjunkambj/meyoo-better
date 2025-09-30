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
import { Spinner } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAgent, type AgentUIMessage } from '@/hooks/useAgent';

const SUGGESTION_PROMPTS = [
  "Optimize high inventory saree shapewear",
  "Analyze Premium Sh...",
  "What's new?",
];

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

  const handleSend = useCallback(async (text?: string) => {
    const messageToSend = text || message.trim();
    if (!messageToSend || isSending) return;

    setMessage('');
    setIsTyping(true);

    try {
      const result = await sendMessage({
        message: messageToSend,
        threadId,
        title: messageToSend.slice(0, 40),
      });

      // If this was a new chat, update URL with the new thread ID
      if (!threadId && result?.threadId) {
        router.setParams({ threadId: result.threadId });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (!text) setMessage(messageToSend); // Restore message on error only if typed
    } finally {
      setIsTyping(false);
    }
  }, [message, isSending, sendMessage, threadId, router]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    handleSend(suggestion);
  }, [handleSend]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNewChat = useCallback(() => {
    router.push('/agent');
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
  const showEmpty = (!messages || messages.length === 0) && !isLoadingMessages;

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
          <View className="flex-1 items-center justify-center gap-8 px-6">
            {/* Mascot Icon */}
            <View className="items-center gap-4">
              <View className="h-20 w-20 rounded-full bg-primary items-center justify-center">
                <Text className="text-4xl">🤖</Text>
              </View>
              <View className="items-center gap-2">
                <Text className="text-2xl font-bold text-foreground">
                  Hey Bold
                </Text>
                <Text className="text-xl font-semibold text-primary">
                  How can I help?
                </Text>
              </View>
            </View>

            {/* Suggestion Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, gap: 12 }}
            >
              {SUGGESTION_PROMPTS.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSuggestionPress(prompt)}
                  className="px-5 py-3 bg-surface-2 rounded-full border border-border/40"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-primary" />
                    <Text className="text-sm text-foreground">
                      {prompt}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <>
            {messages?.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && (
              <View className="flex-row justify-start mb-4">
                <View className="bg-surface-2 px-4 py-3 rounded-3xl rounded-bl-md">
                  <View className="flex-row gap-1.5">
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
        <View className="px-4 py-3 bg-background border-t border-border/20">
          <View className="flex-row items-end gap-2 px-2">
            {/* Attachment Button */}
            <TouchableOpacity className="h-10 w-10 items-center justify-center mb-0.5">
              <Ionicons name="at" size={24} color="#666" />
            </TouchableOpacity>

            {/* Link/Attach Button */}
            <TouchableOpacity className="h-10 w-10 items-center justify-center mb-0.5">
              <Ionicons name="link" size={24} color="#666" />
            </TouchableOpacity>

            {/* Input Field */}
            <View className="flex-1 min-h-[44px] max-h-[120px] bg-surface-1 rounded-3xl px-4 py-2.5 border border-border/40">
              <TextInput
                ref={inputRef}
                value={message}
                onChangeText={setMessage}
                placeholder="Ask anything..."
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
                className="text-foreground text-base"
                style={{ minHeight: 24, maxHeight: 100 }}
                onSubmitEditing={() => {
                  if (message.trim() && !isSending) {
                    handleSend();
                  }
                }}
              />
            </View>

            {/* Voice/Send Button */}
            {message.trim() ? (
              <TouchableOpacity
                onPress={() => handleSend()}
                disabled={isSending}
                className="h-11 w-11 rounded-full bg-primary items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-up" size={24} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity className="h-11 w-11 items-center justify-center">
                <Ionicons name="mic" size={24} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}