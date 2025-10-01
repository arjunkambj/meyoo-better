import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextField } from 'heroui-native';

import type { AgentThread } from '@/hooks/useAgent';

type AgentConversationItemProps = {
  thread: AgentThread;
  isActive: boolean;
  onSelect: (threadId: string) => void;
  onRename: (threadId: string, nextTitle: string) => Promise<void>;
  onDelete: () => void;
};

function formatTimestamp(timestamp: number | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return 'Recently created';
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return 'Recently created';
  }
}

const FALLBACK_TITLE = 'New chat';

export function AgentConversationItem({
  thread,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: AgentConversationItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title ?? '');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isRenaming) {
      setDraft(thread.title ?? '');
    }
  }, [thread.title, isRenaming]);

  const handleRename = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    try {
      await onRename(thread.threadId, trimmed);
      setIsRenaming(false);
    } catch (error) {
      console.error('Failed to rename agent thread', error);
    } finally {
      setIsBusy(false);
    }
  }, [draft, isBusy, onRename, thread.threadId]);

  return (
    <View
      className={`rounded-2xl border px-3 py-3 ${
        isActive ? 'border-primary-200 bg-primary-50/60' : 'border-border bg-background'
      }`}
    >
      <Button
        variant="ghost"
        className="justify-start rounded-xl"
        onPress={() => onSelect(thread.threadId)}
      >
        <View className="flex-1">
          <Text className="text-sm font-semibold text-left">
            {thread.title ?? FALLBACK_TITLE}
          </Text>
          <Text className="text-[11px] text-default-500 text-left mt-0.5">
            {formatTimestamp(thread.createdAt)}
          </Text>
        </View>
      </Button>

      {isRenaming ? (
        <View className="mt-3 gap-2">
          <TextField>
            <TextField.Label>Conversation title</TextField.Label>
            <TextField.Input
              autoFocus
              value={draft}
              onChangeText={setDraft}
              placeholder="Name this conversation"
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />
          </TextField>
          <View className="flex-row gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              isDisabled={!draft.trim() || isBusy}
              onPress={handleRename}
            >
              {isBusy ? 'Saving...' : 'Save title'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onPress={() => {
                if (isBusy) return;
                setIsRenaming(false);
                setDraft(thread.title ?? '');
              }}
            >
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            onPress={() => {
              setDraft(thread.title ?? '');
              setIsRenaming(true);
            }}
          >
            Rename
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="flex-1"
            onPress={onDelete}
          >
            Delete
          </Button>
        </View>
      )}
    </View>
  );
}
