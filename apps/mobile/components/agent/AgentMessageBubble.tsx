import { memo, type JSX } from 'react';
import { Text, View } from 'react-native';

import type { AgentUIMessage } from '@/hooks/useAgent';

type AgentMessageBubbleProps = {
  message: AgentUIMessage;
  isLocal?: boolean;
};

const roleStyles: Record<AgentUIMessage['role'], string> = {
  user: 'bg-primary-500 text-white self-end',
  assistant: 'bg-default-100 text-default-800 self-start',
  system: 'bg-warning-100 text-warning-900 self-start',
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
  const isThinking = message.text === '__thinking__';
  const bubbleClasses = roleStyles[message.role] ?? roleStyles.assistant;
  const content = isThinking ? 'Thinking...' : messagePartsToText(message) || '...';

  return (
    <View className={`max-w-[85%] rounded-3xl px-4 py-3 ${bubbleClasses}`}>
      <Text className={`text-sm leading-5 ${isLocal ? 'opacity-90' : ''}`}>{content}</Text>
    </View>
  );
}

export const AgentMessageBubble = memo(AgentMessageBubbleComponent) as (
  props: AgentMessageBubbleProps,
) => JSX.Element;
