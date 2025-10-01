import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AgentUIMessage, UIMessagePart } from '@repo/types/ui/agent';

export type OptimisticAgentMessage = AgentUIMessage & {
  local: true;
  pendingKey: string;
};

type SequenceSignatureEntry = {
  role: AgentUIMessage['role'];
  text: string;
  isThinkingPlaceholder: boolean;
};

type PendingSequence = {
  key: string;
  savedIds: string[] | null;
  signature: SequenceSignatureEntry[];
};

const createPendingKey = () =>
  `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type AppendSequenceOptions = {
  key?: string;
};

export type AppendableAgentMessage = AgentUIMessage &
  Partial<Pick<OptimisticAgentMessage, 'local' | 'pendingKey'>>;

type UseOptimisticAgentMessagesResult = {
  displayedMessages: (AgentUIMessage | OptimisticAgentMessage)[];
  appendSequence: (sequence: AgentUIMessage[], options?: AppendSequenceOptions) => string;
  markSequenceSaved: (key: string, savedIds: string[] | undefined | null) => void;
  removeSequence: (key: string) => void;
  reset: () => void;
};

const hasContent = (text?: string | null) => typeof text === 'string' && text.trim().length > 0;

const normalizeSavedIds = (savedIds: string[] | undefined | null) =>
  (Array.isArray(savedIds) ? savedIds.filter((id) => typeof id === 'string' && id.length > 0) : []);

const signatureMatchesMessages = (
  signature: SequenceSignatureEntry[],
  messages?: AgentUIMessage[],
) => {
  if (!messages || signature.length === 0 || messages.length < signature.length) {
    return false;
  }

  const tailOffset = messages.length - signature.length;

  for (let index = 0; index < signature.length; index += 1) {
    const expected = signature[index];
    if (!expected) {
      return false;
    }

    const candidate = messages[tailOffset + index];

    if (!candidate || candidate.role !== expected.role) {
      return false;
    }

    if (expected.isThinkingPlaceholder) {
      continue;
    }

    const candidateText = (candidate.text ?? '').trim();
    if (candidateText !== expected.text) {
      return false;
    }
  }

  return true;
};

/**
 * Provides shared optimistic UI handling for Convex agent chats.
 * Keeps local placeholders until the server confirms the messages exist.
 */
export function useOptimisticAgentMessages(
  messages: AgentUIMessage[] | undefined,
): UseOptimisticAgentMessagesResult {
  const [localMessages, setLocalMessages] = useState<OptimisticAgentMessage[]>([]);
  const pendingSequencesRef = useRef<PendingSequence[]>([]);
  const latestMessagesRef = useRef<AgentUIMessage[] | undefined>(messages);

  const flushResolvedSequences = useCallback((currentMessages?: AgentUIMessage[]) => {
    if (!currentMessages || currentMessages.length === 0) return;

    const existingIds = new Set(currentMessages.map((msg) => msg.id));
    const toRemoveKeys: string[] = [];
    const remaining: PendingSequence[] = [];

    for (const sequence of pendingSequencesRef.current) {
      let shouldRemove = false;

      if (!sequence.savedIds || sequence.savedIds.length === 0) {
        shouldRemove = signatureMatchesMessages(sequence.signature, currentMessages);
      } else {
        const allSavedIdsPresent = sequence.savedIds.every((savedId) => existingIds.has(savedId));
        if (allSavedIdsPresent) {
          shouldRemove = true;
        } else {
          shouldRemove = signatureMatchesMessages(sequence.signature, currentMessages);
        }
      }

      if (shouldRemove) {
        toRemoveKeys.push(sequence.key);
      } else {
        remaining.push(sequence);
      }
    }

    if (toRemoveKeys.length === 0) {
      return;
    }

    pendingSequencesRef.current = remaining;
    if (toRemoveKeys.length > 0) {
      setLocalMessages((prev) =>
        prev.filter((message) => !toRemoveKeys.includes(message.pendingKey)),
      );
    }
  }, []);

  useEffect(() => {
    latestMessagesRef.current = messages;
    if (messages && messages.length > 0) {
      flushResolvedSequences(messages);
    }
  }, [messages, flushResolvedSequences]);

  const appendSequence = useCallback(
    (sequence: AgentUIMessage[], options?: AppendSequenceOptions) => {
      if (!sequence || sequence.length === 0) {
        throw new Error('Cannot append an empty agent message sequence');
      }

      const key = options?.key ?? createPendingKey();
      const signature: SequenceSignatureEntry[] = sequence.map((message) => {
        const text = typeof message.text === 'string' ? message.text.trim() : '';
        const isThinkingPlaceholder =
          message.role === 'assistant' && (message.text === '__thinking__' || text === '__thinking__');

        return {
          role: message.role,
          text,
          isThinkingPlaceholder,
        };
      });

      const nextSequence: PendingSequence = { key, savedIds: null, signature };
      pendingSequencesRef.current = [...pendingSequencesRef.current, nextSequence];

      const normalizedSequence = sequence.map<OptimisticAgentMessage>((message) => {
        const normalizedStatus = hasContent(message.text)
          ? message.status ?? 'local'
          : 'local';

        return {
          ...message,
          local: true,
          pendingKey: key,
          status: normalizedStatus,
        };
      });

      setLocalMessages((prev) => [...prev, ...normalizedSequence]);

      return key;
    },
    [],
  );

  const removeSequence = useCallback((key: string) => {
    pendingSequencesRef.current = pendingSequencesRef.current.filter(
      (sequence) => sequence.key !== key,
    );
    setLocalMessages((prev) => prev.filter((message) => message.pendingKey !== key));
  }, []);

  const markSequenceSaved = useCallback(
    (key: string, savedIds: string[] | undefined | null) => {
      const normalizedIds = normalizeSavedIds(savedIds);
      if (normalizedIds.length === 0) {
        removeSequence(key);
        return;
      }

      const nextSequences = pendingSequencesRef.current.map((sequence) =>
        sequence.key === key ? { ...sequence, savedIds: normalizedIds } : sequence,
      );
      pendingSequencesRef.current = nextSequences;

      if (latestMessagesRef.current && latestMessagesRef.current.length > 0) {
        flushResolvedSequences(latestMessagesRef.current);
      }
    },
    [flushResolvedSequences, removeSequence],
  );

  const reset = useCallback(() => {
    pendingSequencesRef.current = [];
    setLocalMessages([]);
  }, []);

  const displayedMessages = useMemo(() => {
    if (!messages || messages.length === 0) {
      return localMessages;
    }
    if (localMessages.length === 0) {
      return messages;
    }

    const serverIds = new Set(messages.map((message) => message.id));
    const dedupedLocals = localMessages.filter((message) => !serverIds.has(message.id));

    return [...messages, ...dedupedLocals];
  }, [messages, localMessages]);

  return {
    displayedMessages,
    appendSequence,
    markSequenceSaved,
    removeSequence,
    reset,
  };
}

export function inferAgentThinkingLabel(parts?: UIMessagePart[] | null): string {
  if (!parts || parts.length === 0) return 'Thinking…';

  try {
    const toolPart = parts.find(
      (part) => part && part.type && (part.type === 'tool' || part.type === 'step-start'),
    );

    const rawName = toolPart ? (toolPart.toolName ?? toolPart.name ?? toolPart.tool) : undefined;
    const name = typeof rawName === 'string' ? rawName.toLowerCase() : '';

    if (name.includes('inventory')) return 'Reading inventory details…';
    if (name.includes('meta') || name.includes('ads')) return 'Reading meta analytics…';
    if (name.includes('google')) return 'Reading Google analytics…';
    if (name.includes('order')) return 'Summarizing orders…';
    if (name.includes('brand')) return 'Fetching brand summary…';
    if (name.includes('email') || name.includes('campaign')) return 'Reviewing campaigns…';
    return 'Thinking…';
  } catch (_error) {
    return 'Thinking…';
  }
}

export const isOptimisticAgentMessage = (
  message: AgentUIMessage | OptimisticAgentMessage,
): message is OptimisticAgentMessage => {
  const candidate = message as Partial<OptimisticAgentMessage>;
  return candidate.local === true;
};
