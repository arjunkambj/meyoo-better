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
      <div className="flex items-end gap-1">
        <div className="flex-1 relative">
          <Textarea
            aria-label="Chat message"
            className="w-full"
            variant="bordered"
            size="sm"
            minRows={4}
            maxRows={4}
            isDisabled={disabled}
            isReadOnly={busy}
            placeholder={placeholder}
            value={message}
            onValueChange={setMessage}
            classNames={{
              // Keep background stable; highlight border on hover/focus
              inputWrapper:
                "bg-transparent hover:bg-transparent focus-within:bg-transparent border-default hover:border-primary focus-within:border-primary",
              input: "bg-transparent",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <div className="absolute right-1 bottom-1">
            <Tooltip content={canSend ? "Send" : "Type a message"}>
              <Button
                isIconOnly
                size="sm"
                color="primary"
                radius="lg"
                variant="flat"
                isDisabled={!canSend}
                isLoading={busy}
                onPress={handleSend}
              >
                <Icon icon="mdi:send" width={16} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
