import { useMemo } from 'react';
import { View } from 'react-native';
import { Button, TextField } from 'heroui-native';

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
  placeholder = 'Type your question or task...',
}: AgentChatComposerProps) {
  const trimmed = useMemo(() => value.trim(), [value]);
  const isSendDisabled = trimmed.length === 0 || disabled || loading;

  return (
    <View className="gap-3">
      <TextField>
        <TextField.Label>Message Meyoo Agent</TextField.Label>
        <TextField.Input
          multiline
          numberOfLines={3}
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
        />
      </TextField>
      <Button
        variant="primary"
        onPress={onSend}
        isDisabled={isSendDisabled}
        className="h-12"
      >
        {loading ? 'Sending...' : 'Send message'}
      </Button>
    </View>
  );
}
