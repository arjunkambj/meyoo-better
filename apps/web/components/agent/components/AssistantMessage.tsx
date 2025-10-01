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
      console.debug("copy failed", err);
    }
  };

  return (
    <div className="flex items-start py-1.5">
      <div className="max-w-[85%] group relative">
        <div className="inline-block rounded-2xl rounded-tl-sm bg-default-200/40 text-foreground text-sm px-4 py-3 leading-relaxed">
          <AgentResponseFormatter
            content={content}
            onCopy={() => void handleCopyAll()}
          />
        </div>
        {streaming ? null : (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={handleCopyAll}
              className="hover:bg-default-200 text-default-600"
            >
              <Icon icon="solar:copy-bold-duotone" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={() => onVote?.("up")}
              className="hover:bg-default-200 text-default-600"
            >
              <Icon icon="solar:like-bold-duotone" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="lg"
              onPress={() => onVote?.("down")}
              className="hover:bg-default-200 text-default-600"
            >
              <Icon icon="solar:dislike-bold-duotone" width={16} />
            </Button>
          </div>
        )}
        {timeLabel ? (
          <div className="text-[10px] text-default-500 mt-1.5 px-1">
            {timeLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
