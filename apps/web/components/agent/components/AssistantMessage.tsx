"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import AgentResponseFormatter from "@/components/agent/components/AgentResponseFormatter";

export default function AssistantMessage({
  content,
  timeLabel,
  onVote,
  streaming = false,
}: {
  content: string;
  timeLabel?: string;
  onVote?: (v: "up" | "down") => void;
  streaming?: boolean;
}) {
  const [, setCopied] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.debug('copy failed', err);
    }
  };

  return (
    <div className="flex items-start py-1">
      <div className="max-w-[90%] group relative">
        <div className="inline-block rounded-2xl rounded-tl-sm bg-content2 text-foreground text-sm px-3 py-2">
          <AgentResponseFormatter content={content} onCopy={() => void handleCopyAll()} />
        </div>
        {streaming ? null : (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-default-600">
            <Button isIconOnly size="sm" variant="light" onPress={handleCopyAll}>
              <Icon icon="solar:copy-bold" width={13} />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={() => onVote?.("up")}>
              <Icon icon="solar:like-bold" width={13} />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={() => onVote?.("down")}>
              <Icon icon="solar:dislike-bold" width={13} />
            </Button>
          </div>
        )}
        {timeLabel ? (
          <div className="text-[10px] text-default-500 mt-1">{timeLabel}</div>
        ) : null}
      </div>
    </div>
  );
}
