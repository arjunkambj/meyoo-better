"use client";

import {useState} from "react";
import {Button, Tooltip} from "@heroui/react";
import {Icon} from "@iconify/react";
import AgentResponseFormatter from "@/components/agent/components/AgentResponseFormatter";

export default function AssistantMessage({
  content,
  timeLabel,
  onVote,
}: {
  content: string;
  timeLabel?: string;
  onVote?: (v: "up" | "down") => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {}
  };

  return (
    <div className="flex items-start py-1">
      <div className="max-w-[90%] group relative">
        <div className="inline-block rounded-2xl rounded-tl-sm bg-content2 text-foreground text-sm px-3 py-2">
          <AgentResponseFormatter content={content} onCopy={() => void handleCopyAll()} />
        </div>
        <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-content2 border border-default-100 rounded-medium px-1 py-0.5 flex items-center gap-1 shadow-small">
            <Tooltip content={copied ? "Copied" : "Copy"}>
              <Button isIconOnly size="sm" variant="light" onPress={handleCopyAll}>
                <Icon icon="solar:copy-bold" width={14} />
              </Button>
            </Tooltip>
            <Tooltip content="Upvote">
              <Button isIconOnly size="sm" variant="light" onPress={() => onVote?.("up")}> 
                <Icon icon="solar:like-bold" width={14} />
              </Button>
            </Tooltip>
            <Tooltip content="Downvote">
              <Button isIconOnly size="sm" variant="light" onPress={() => onVote?.("down")}> 
                <Icon icon="solar:dislike-bold" width={14} />
              </Button>
            </Tooltip>
          </div>
        </div>
        {timeLabel ? (
          <Tooltip content={timeLabel}>
            <div className="text-[10px] text-default-500 mt-1">{timeLabel}</div>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
