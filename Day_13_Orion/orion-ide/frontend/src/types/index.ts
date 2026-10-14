export interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileNode[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  modified: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface AgentTask {
  filepath: string;
  description: string;
  action: 'create' | 'modify';
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

export interface ReviewChange {
  filepath: string;
  action?: 'create' | 'modify';
  explanation: string;
  preview: string;
  code?: string;
  diff?: string;
}

export interface PendingReview {
  threadId: string;
  plan: string;
  reviewResult: string;
  testOutput: string;
  changes: ReviewChange[];
}

export interface KeyCheck {
  ok: boolean;
  message: string;
  label: string;
  usage: number | null;
  limit: number | null;
}

export interface RuleSummary {
  name: string;
  source: string;
  description: string;
  globs: string[];
  always_apply: boolean;
}

export interface SkillSummary {
  name: string;
  description: string;
  paths: string[];
  model_invocable: boolean;
  source: string;
}

export interface Checkpoint {
  step: number;
  status: string;
  next: string[];
  timestamp: number;
  values: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
}
