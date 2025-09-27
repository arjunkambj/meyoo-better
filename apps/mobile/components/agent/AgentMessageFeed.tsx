import { ScrollView, Text, View } from 'react-native';
import { Button, Skeleton } from 'heroui-native';

import type { AgentUIMessage } from '@/hooks/useAgent';
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

const DEFAULT_EMPTY_HINT =
  'Try "Summarize our latest Shopify sync" or "What should I do before the new marketing campaign?"';

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
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-3xl" />
        ))}
      </View>
    ) : showEmpty ? (
      <View className="items-center justify-center py-16 gap-2">
        <Text className="text-sm font-semibold text-default-600">
          Ask the Meyoo Agent anything
        </Text>
        <Text className="text-xs text-default-500 text-center px-6">
          {emptyHint}
        </Text>
      </View>
    ) : (
      messages.map((message) => (
        <AgentMessageBubble
          key={message.id}
          message={message}
          isLocal={message.id.startsWith('local-')}
        />
      ))
      )}
    </ScrollView>
  );
}
