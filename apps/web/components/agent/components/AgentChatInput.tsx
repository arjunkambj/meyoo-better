"use client";

import { useCallback, useState } from "react";
import { Button, Textarea, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { cn } from "@heroui/theme";

export type AgentChatInputProps = {
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  onSend: (message: string) => void | Promise<void>;
};

export default function AgentChatInput({
  placeholder = "Ask anything…",
  disabled = false,
  busy = false,
  className,
  onSend,
}: AgentChatInputProps) {
  const [message, setMessage] = useState("");

  const canSend = message.trim().length > 0 && !busy && !disabled;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const content = message.trim();
    setMessage("");
    await onSend(content);
  }, [canSend, message, onSend]);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <Textarea
          aria-label="Chat message"
          className="w-full"
          size="sm"
          minRows={4}
          maxRows={4}
          isDisabled={disabled}
          isReadOnly={busy}
          placeholder={placeholder}
          value={message}
          onValueChange={setMessage}
          classNames={{
            // Keep background stable across all states
            inputWrapper: cn(
              "bg-background rounded-lg",
              "hover:bg-default-100",
              "focus-within:bg-background",
              "data-[hover=true]:bg-background ",
              "border-1",
              "hover:border-primary-300",
              "focus-within:border-primary",
              "transition-colors duration-200",
              "pr-12" // Add padding for the button
            ),
            input: cn("bg-transparent", "placeholder:text-default-500"),
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="absolute right-2 bottom-2 z-10">
          <Tooltip content={canSend ? "Send" : "Type a message"}>
            <Button
              isIconOnly
              size="sm"
              color="primary"
              radius="lg"
              variant="solid"
              isDisabled={!canSend}
              isLoading={busy}
              onPress={handleSend}
            >
              <Icon icon="solar:plain-2-bold-duotone" width={20} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
