import { Text, View } from 'react-native';
import { Button, Skeleton } from 'heroui-native';

import type { AgentThread } from '@/hooks/useAgent';
import { AgentConversationItem } from './AgentConversationItem';

type AgentThreadListProps = {
  threads?: AgentThread[];
  isLoading: boolean;
  activeThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onRenameThread: (threadId: string, nextTitle: string) => Promise<void>;
  onDeleteThread: (thread: AgentThread) => void;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
};

export function AgentThreadList({
  threads,
  isLoading,
  activeThreadId,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  canLoadMore = false,
  onLoadMore,
  loadingMore = false,
}: AgentThreadListProps) {
  if (isLoading && (!threads || threads.length === 0)) {
    return (
      <View className="gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </View>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <View className="gap-1">
        <Text className="text-sm font-medium text-default-600">
          No conversations yet
        </Text>
        <Text className="text-xs text-default-500">
          Ask a question to create your first thread.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {threads.map((thread) => (
        <AgentConversationItem
          key={thread.threadId}
          thread={thread}
          isActive={thread.threadId === activeThreadId}
          onSelect={onSelectThread}
          onRename={onRenameThread}
          onDelete={() => onDeleteThread(thread)}
        />
      ))}

      {canLoadMore ? (
        <Button variant="ghost" size="sm" onPress={onLoadMore}>
          {loadingMore ? 'Loading...' : 'Load more conversations'}
        </Button>
      ) : null}
    </View>
  );
}
