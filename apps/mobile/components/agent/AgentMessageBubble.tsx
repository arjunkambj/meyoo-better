import { memo, type JSX } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';

import type { AgentUIMessage } from '@/hooks/useAgent';

type AgentMessageBubbleProps = {
  message: AgentUIMessage;
  isLocal?: boolean;
};

const messagePartsToText = (message: AgentUIMessage): string => {
  if (message.text && message.text.trim().length > 0) {
    return message.text.trim();
  }

  if (!message.parts || message.parts.length === 0) {
    return '';
  }

  const collected = message.parts
    .map((part) => {
      if (typeof (part as any).text === 'string') {
        return ((part as any).text as string).trim();
      }
      if (typeof (part as any).content === 'string') {
        return ((part as any).content as string).trim();
      }
      if (Array.isArray((part as any).content)) {
        return ((part as any).content as unknown[])
          .map((chunk) => (typeof chunk === 'string' ? chunk.trim() : ''))
          .filter(Boolean)
          .join(' ');
      }
      if (part.toolName) {
        return `[${part.toolName}]`;
      }
      if (part.type) {
        return `[${part.type}]`;
      }
      return '';
    })
    .filter((chunk) => chunk.length > 0);

  return collected.join('\n');
};

function AgentMessageBubbleComponent({ message, isLocal = false }: AgentMessageBubbleProps) {
  const { colors } = useTheme();
  const isThinking = message.text === '__thinking__';
  const content = isThinking ? 'Thinking...' : messagePartsToText(message) || '...';
  const isUser = message.role === 'user';

  return (
    <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <View className="h-8 w-8 rounded-full bg-accent/10 items-center justify-center mr-2 mt-0.5">
          <Ionicons name="sparkles" size={14} color={colors.accent} />
        </View>
      )}
      <View
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent rounded-tr-sm'
            : 'bg-surface-3 rounded-tl-sm'
        }`}
        style={isLocal ? { opacity: 0.85 } : undefined}
      >
        {isThinking ? (
          <View className="flex-row items-center gap-2">
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.defaultForeground} />
            <Text className="text-sm text-default-500">Thinking...</Text>
          </View>
        ) : (
          <Text
            className={`text-sm leading-6 ${
              isUser ? 'text-accent-foreground' : 'text-foreground'
            }`}
          >
            {content}
          </Text>
        )}
      </View>
      {isUser && (
        <View className="h-8 w-8 rounded-full bg-accent/20 items-center justify-center ml-2 mt-0.5">
          <Ionicons name="person" size={14} color={colors.accent} />
        </View>
      )}
    </View>
  );
}

export const AgentMessageBubble = memo(AgentMessageBubbleComponent) as (
  props: AgentMessageBubbleProps,
) => JSX.Element;