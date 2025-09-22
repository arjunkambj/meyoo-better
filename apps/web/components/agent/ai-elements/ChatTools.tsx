"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/libs/utils";

interface Tool {
  id: string;
  name: string;
  icon: string;
  description: string;
  active?: boolean;
}

interface ChatToolsProps {
  tools?: Tool[];
  onToolClick: (toolId: string) => void;
  className?: string;
}

const defaultTools: Tool[] = [
  {
    id: "web-search",
    name: "Web Search",
    icon: "solar:global-search-linear",
    description: "Search the web for information",
  },
  {
    id: "calculator",
    name: "Calculator",
    icon: "solar:calculator-linear",
    description: "Perform calculations",
  },
  {
    id: "code",
    name: "Code",
    icon: "solar:code-square-linear",
    description: "Write and execute code",
  },
  {
    id: "chart",
    name: "Charts",
    icon: "solar:chart-2-linear",
    description: "Create data visualizations",
  },
];

export default function ChatTools({
  tools = defaultTools,
  onToolClick,
  className,
}: ChatToolsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 p-3", className)}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolClick(tool.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            "text-sm rounded-lg border",
            "transition-all",
            tool.active
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-default-200 text-default-700 hover:bg-default-50"
          )}
          title={tool.description}
        >
          <Icon icon={tool.icon} width={16} />
          <span>{tool.name}</span>
        </button>
      ))}
    </div>
  );
}

export function InlineToolIndicator({
  toolName,
  icon,
  className,
}: {
  toolName: string;
  icon: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1",
        "text-xs font-medium rounded-md",
        "bg-primary/10 text-primary border border-primary/20",
        className
      )}
    >
      <Icon icon={icon} width={14} />
      <span>{toolName}</span>
    </div>
  );
}