export type AgentRole = 'user' | 'assistant' | 'system';

export type AgentUIMessageStatus = 'streaming' | 'complete' | 'queued' | 'local';

export type UIMessagePart = {
  type: string;
  toolName?: string;
  name?: string;
  tool?: string;
  [key: string]: unknown;
};

export type AgentUIMessage = {
  id: string;
  role: AgentRole;
  text: string;
  status?: AgentUIMessageStatus | string;
  parts?: UIMessagePart[];
};
