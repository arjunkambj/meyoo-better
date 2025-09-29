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
          size="md"
          minRows={3}
          maxRows={8}
          isDisabled={disabled}
          isReadOnly={busy}
          placeholder={placeholder}
          value={message}
          onValueChange={setMessage}
          classNames={{
            inputWrapper: cn(
              "bg-default-50 rounded-xl",
              "hover:bg-default-100",
              "focus-within:bg-background",
              "data-[hover=true]:bg-default-100",
              "border-2 border-default-200",
              "hover:border-default-300",
              "focus-within:border-primary",
              "transition-all duration-200",
              "pr-14 pb-12"
            ),
            input: cn(
              "bg-transparent text-sm",
              "placeholder:text-default-400",
              "min-h-[60px]"
            ),
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1.5">
          <div className="text-xs text-default-400 mr-1">
            {!busy && message.length > 0 && "↵ to send"}
          </div>
          <Tooltip
            content={canSend ? "Send message" : "Type a message"}
            delay={500}
          >
            <Button
              isIconOnly
              size="md"
              color="primary"
              radius="lg"
              variant="flat"
              isDisabled={!canSend}
              isLoading={busy}
              onPress={handleSend}
              className="hover:scale-105 transition-transform"
            >
              <Icon icon="solar:plain-2-bold-duotone" width={20} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
