"use client";

import type React from "react";
import {useMemo} from "react";
import {Button, Divider, Tooltip} from "@heroui/react";
import {Icon} from "@iconify/react";

type CodeBlock = { type: "code"; lang?: string; value: string };
type ParagraphBlock = { type: "paragraph"; value: string };
type HeadingBlock = { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; value: string };
type QuoteBlock = { type: "blockquote"; value: string };
type ListBlock = { type: "list"; ordered: boolean; items: string[] };
type HrBlock = { type: "hr" };
type Block =
  | CodeBlock
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | ListBlock
  | HrBlock;

export type AgentResponseFormatterProps = {
  content: string;
  className?: string;
  onCopy?: (text: string) => void;
};

function tokenizeMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replaceAll("\r\n", "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw ?? "";
    // skip blank lines
    if (!line.trim()) {
      i++;
      continue;
    }
    // code fence
    if (line.startsWith("```") ) {
      const lang = line.slice(3).trim() || undefined;
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```") ) {
        codeLines.push(lines[i]);
        i++;
      }
      // consume closing fence if present
      if (i < lines.length && lines[i].startsWith("```") ) i++;
      blocks.push({ type: "code", lang, value: codeLines.join("\n") });
      continue;
    }
    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const depth = h[1].length as HeadingBlock["depth"];
      blocks.push({ type: "heading", depth, value: h[2].trim() });
      i++;
      continue;
    }
    // hr
    if (/^(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    // blockquote (gather contiguous > lines)
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", value: quote.join("\n") });
      continue;
    }
    // unordered list
    if (/^\s*[-+*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-+*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-+*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }
    // paragraph: collect until blank or other block
    const paras: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() &&
           !lines[i].startsWith("```") &&
           !/^(#{1,6})\s+/.test(lines[i]) &&
           !/^>\s?/.test(lines[i]) &&
           !/^\s*[-+*]\s+/.test(lines[i]) &&
           !/^\s*\d+\.\s+/.test(lines[i]) &&
           !/^(\*\s*\*\s*\*|-{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paras.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", value: paras.join(" ") });
  }
  return blocks;
}

function transformTextNodes(
  nodes: React.ReactNode[],
  pattern: RegExp,
  wrap: (match: RegExpExecArray, key: number) => React.ReactNode
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const node of nodes) {
    if (typeof node !== "string") {
      out.push(node);
      continue;
    }
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(node)) !== null) {
      if (m.index > last) out.push(node.slice(last, m.index));
      out.push(wrap(m, key++));
      last = pattern.lastIndex;
    }
    if (last < node.length) out.push(node.slice(last));
  }
  return out;
}

function renderInline(text: string): React.ReactNode[] {
  let nodes: React.ReactNode[] = [text];
  // inline code
  nodes = transformTextNodes(nodes, /`([^`]+)`/g, (m, key) => (
    <code key={key} className="rounded-small bg-content3 px-1 py-0.5 text-xs">
      {m[1]}
    </code>
  ));
  // links [text](url)
  nodes = transformTextNodes(nodes, /\[([^\]]+)\]\(([^)\s]+)\)/g, (m, key) => (
    <a key={key} href={m[2]} target="_blank" rel="noreferrer" className="text-primary underline">
      {m[1]}
    </a>
  ));
  // bold **text**
  nodes = transformTextNodes(nodes, /\*\*([^*]+)\*\*/g, (m, key) => (
    <strong key={key}>{m[1]}</strong>
  ));
  // italic *text*
  nodes = transformTextNodes(nodes, /(^|\W)\*([^*]+)\*(?=\W|$)/g, (m, key) => (
    <em key={key}>{m[2]}</em>
  ));
  return nodes;
}

export default function AgentResponseFormatter({ content, className, onCopy }: AgentResponseFormatterProps) {
  const blocks = useMemo(() => tokenizeMarkdown(content), [content]);

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const Tag = (`h${b.depth}` as unknown) as keyof JSX.IntrinsicElements;
            const size = b.depth <= 2 ? "text-sm" : b.depth === 3 ? "text-[13px]" : "text-xs";
            return (
              <Tag key={i} className={`font-semibold ${size} mt-2 mb-1`}>
                {renderInline(b.value)}
              </Tag>
            );
          }
          case "blockquote":
            return (
              <div key={i} className="pl-3 border-l-3 border-default-200 text-default-700 text-sm my-1">
                {renderInline(b.value)}
              </div>
            );
          case "list":
            return b.ordered ? (
              <ol key={i} className="list-decimal pl-4 space-y-1 text-sm my-1">
                {b.items.map((it, idx) => (
                  <li key={idx}>{renderInline(it)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc pl-4 space-y-1 text-sm my-1">
                {b.items.map((it, idx) => (
                  <li key={idx}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "code": {
            const codeText = b.value;
            return (
              <div key={i} className="my-2 rounded-medium border border-default-100 overflow-hidden">
                <div className="flex items-center justify-between bg-content2 px-2 py-1">
                  <span className="text-[10px] text-default-500 uppercase tracking-wide">
                    {b.lang || "code"}
                  </span>
                  <Tooltip content="Copy code">
                    <Button isIconOnly size="sm" variant="light" onPress={() => onCopy?.(codeText)}>
                      <Icon icon="solar:copy-bold" width={14} />
                    </Button>
                  </Tooltip>
                </div>
                <pre className="bg-content1 text-xs px-3 py-2 overflow-x-auto">
                  <code>{codeText}</code>
                </pre>
              </div>
            );
          }
          case "hr":
            return <Divider key={i} className="my-2" />;
          case "paragraph":
          default:
            return (
              <p key={i} className="leading-relaxed text-sm my-1">
                {renderInline((b as ParagraphBlock).value)}
              </p>
            );
        }
      })}
    </div>
  );
}
