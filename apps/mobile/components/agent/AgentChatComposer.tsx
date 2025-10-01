import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import { Button, TextField, useTheme } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";

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
  placeholder = "Ask anything…",
}: AgentChatComposerProps) {
  const { colors } = useTheme();
  const trimmed = useMemo(() => value.trim(), [value]);
  const isSendDisabled = trimmed.length === 0 || disabled || loading;

  const handleKeyPress = useCallback(
    (e: any) => {
      // On native, we handle this via onSubmitEditing
      if (!isSendDisabled) {
        onSend();
      }
    },
    [isSendDisabled, onSend]
  );

  return (
    <View className="w-full">
      <View className="relative">
        <TextField>
          <TextField.Input
            multiline
            numberOfLines={4}
            maxLength={8}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={handleKeyPress}
            className="min-h-[60px] rounded-xl bg-default-50 border-2 border-default-200 px-4 py-3 pr-16 pb-14"
            style={{ maxHeight: 200 }}
          />
        </TextField>

        <View className="absolute right-2.5 bottom-2.5 flex-row items-center gap-1.5">
          {!loading && value.length > 0 && (
            <Text className="text-xs text-default-400 mr-1">↵ to send</Text>
          )}
          <Button
            variant="primary"
            size="md"
            isIconOnly
            onPress={onSend}
            isDisabled={isSendDisabled}
            className="h-10 w-10 rounded-lg"
          >
            {loading ? (
              <Ionicons
                name="hourglass-outline"
                size={20}
                color={colors.accentForeground}
              />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={isSendDisabled ? colors.muted : colors.accentForeground}
              />
            )}
          </Button>
        </View>
      </View>
    </View>
  );
}
