"use client";

import {useCallback, useMemo, useState} from "react";
import {Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Textarea, Tooltip} from "@heroui/react";
import {Icon} from "@iconify/react";
import {cn} from "@heroui/theme";

type ModelOption = {
  value: string;
  label: string;
  helper?: string;
};

export type AgentChatInputProps = {
  models: ModelOption[];
  defaultModel?: string;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  onSend: (message: string, model: string) => void | Promise<void>;
  onModelChange?: (model: string) => void;
  showModelSelector?: boolean;
};

export default function AgentChatInput({
  models,
  defaultModel,
  placeholder = "Ask anything…",
  disabled = false,
  busy = false,
  className,
  onSend,
  onModelChange,
  showModelSelector = true,
}: AgentChatInputProps) {
  const [message, setMessage] = useState("");

  const initialModel = useMemo(() => {
    if (defaultModel) return defaultModel;
    return models[0]?.value ?? "";
  }, [defaultModel, models]);

  const [model, setModel] = useState<string>(initialModel);

  const selectedLabel = useMemo(
    () => models.find((m) => m.value === model)?.label ?? model,
    [models, model]
  );

  const canSend = message.trim().length > 0 && !busy && !disabled && !!model;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const content = message.trim();
    setMessage("");
    await onSend(content, model);
  }, [canSend, message, model, onSend]);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1">
        {showModelSelector ? (
          <Dropdown placement="top-start">
            <DropdownTrigger>
              <Button size="sm" variant="flat" className="shrink-0">
                {selectedLabel}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Model selector"
              selectedKeys={new Set([model])}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const next = Array.from(keys as Set<any>)[0]?.toString() ?? "";
                setModel(next);
                onModelChange?.(next);
              }}
            >
              {models.map((m) => (
                <DropdownItem key={m.value} description={m.helper}>
                  {m.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        ) : null}

        <div className="flex-1 relative">
          <Textarea
            aria-label="Chat message"
            className="w-full"
            size="sm"
            minRows={1}
            maxRows={4}
            isDisabled={disabled}
            isReadOnly={busy}
            placeholder={placeholder}
            value={message}
            onValueChange={setMessage}
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
