import { ScrollView, Text, View } from 'react-native';
import { Button, Skeleton, Spinner } from 'heroui-native';

import type { AgentUIMessage } from '@/hooks/useAgent';
import { inferAgentThinkingLabel } from '@repo/ui/agent/useOptimisticAgentMessages';
import { AgentMessageBubble } from './AgentMessageBubble';

type AgentMessageFeedProps = {
  messages: AgentUIMessage[];
  showEmpty: boolean;
  emptyHint?: string;
  isInitialLoading?: boolean;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onScrollViewReady?: (scrollView: ScrollView | null) => void;
};

const DEFAULT_EMPTY_HINT = 'Your Meyoo Agent messages will show here.';

export function AgentMessageFeed({
  messages,
  showEmpty,
  emptyHint = DEFAULT_EMPTY_HINT,
  isInitialLoading = false,
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
  onScrollViewReady,
}: AgentMessageFeedProps): React.JSX.Element {
  return (
    <ScrollView
      ref={(node) => {
        onScrollViewReady?.(node);
      }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
    >
      {canLoadMore ? (
        <Button size="sm" variant="ghost" onPress={onLoadMore}>
          {loadingMore ? 'Loading...' : 'Load earlier messages'}
        </Button>
      ) : null}

      {isInitialLoading && messages.length === 0 ? (
        <View className="gap-3 py-16">
          <Skeleton className="h-20 rounded-3xl" />
        </View>
      ) : showEmpty ? (
        <View className="items-center justify-center py-16 gap-2 px-6">
          <Text className="text-sm font-semibold text-default-600">
            No messages yet.
          </Text>
          {emptyHint ? (
            <Text className="text-xs text-default-500 text-center">
              {emptyHint}
            </Text>
          ) : null}
        </View>
      ) : (
        messages.map((message) => {
          const isStreaming = message.role === 'assistant' && message.status === 'streaming';
          const trimmed = message.text?.trim() ?? '';
          const isThinking =
            message.text === '__thinking__' || (isStreaming && trimmed.length === 0);

          if (isThinking) {
            const label = inferAgentThinkingLabel(message.parts ?? undefined);
            return (
              <View key={message.id} className="flex-row items-center gap-2 self-start">
                <Spinner size="sm" />
                <Text className="text-xs text-default-600">{label}</Text>
              </View>
            );
          }

          return (
            <AgentMessageBubble
              key={message.id}
              message={message}
              isLocal={message.id.startsWith('local-')}
            />
          );
        })
      )}
    </ScrollView>
  );
}
