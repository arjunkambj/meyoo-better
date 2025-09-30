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
  onSend: (message: string) => void | boolean | Promise<void | boolean>;
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
    try {
      const result = await onSend(content);
      if (result === false) {
        setMessage(content);
      }
    } catch (error) {
      console.error("Failed to send chat message", error);
      setMessage(content);
    }
  }, [canSend, message, onSend]);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <Textarea
          aria-label="Chat message"
          className="w-full"
          
          minRows={4}
          maxRows={4}
          isDisabled={disabled}
          isReadOnly={busy}
          placeholder={placeholder}
          value={message}
          onValueChange={setMessage}
          classNames={{
            inputWrapper: cn(
              "bg-default-50",
              "rounded-2xl",
              "hover:bg-default-50",
              "focus-within:bg-background",
              "data-[hover=true]:bg-default-50",
              "border-2 border-default-200",
              "hover:border-default-300",
              "focus-within:border-primary",
              "transition-all duration-200",
              "px-3 pt-2"
            ),
            input: cn(
              "bg-transparent text-base leading-relaxed",
              "placeholder:text-default-400",
              "min-h-[52px]"
            ),
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="absolute right-3.5 bottom-3 z-10 flex items-center gap-2">
          <div className="text-xs text-default-400 mr-1.5">
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
              className="h-10 w-10 text-base shadow-sm hover:scale-105 transition-transform"
            >
              <Icon icon="solar:plain-2-bold-duotone" width={22} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
