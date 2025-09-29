import { useMemo } from 'react';
import { View } from 'react-native';
import { Button, TextField, useTheme } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';

type AgentChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
};

export function AgentChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  loading = false,
  placeholder = 'Ask a question or describe a task...',
}: AgentChatComposerProps) {
  const { colors } = useTheme();
  const trimmed = useMemo(() => value.trim(), [value]);
  const isSendDisabled = trimmed.length === 0 || disabled || loading;

  return (
    <View className="flex-row items-end gap-2">
      <View className="flex-1">
        <TextField>
          <TextField.Input
            multiline
            numberOfLines={2}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (!isSendDisabled) {
                onSend();
              }
            }}
            className="rounded-2xl bg-surface-3 border border-border/40 px-4 py-3"
          />
        </TextField>
      </View>
      <Button
        variant="primary"
        size="lg"
        isIconOnly
        onPress={onSend}
        isDisabled={isSendDisabled}
        className="h-12 w-12 rounded-full"
      >
        <Ionicons
          name={loading ? 'hourglass-outline' : 'send'}
          size={20}
          color={isSendDisabled ? colors.muted : colors.accentForeground}
        />
      </Button>
    </View>
  );
}