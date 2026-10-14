export type LogTag =
  | "BOOT"
  | "INFO"
  | "OK"
  | "STREAM"
  | "WARN"
  | "ERROR"
  | "SUCCESS"
  | "PROCESS"
  | "TOOL"
  | "RETRY";

export type LogLine = {
  tag?: LogTag;
  text: string;
  ts?: string;
};

export type CodeFile = {
  filename: string;
  language: string;
  content: string;
};

export type WorkspaceFile = {
  path: string;
  content: string;
};

export type TraceStep = {
  type: "human" | "ai" | "tool";
  content: string;
  toolName?: string;
  toolArgs?: string[];
};

export type FixturePair = {
  label: string;
  description: string;
  log: LogLine[];
  output: string;
  paramSnippet?: string;
  codeFile?: CodeFile;
  trace?: TraceStep[];
};

export type DemoOption = {
  key: string;
  label: string;
  description: string;
};

export type DemoInputFile = {
  filename: string;
  preview: string;
};

export type DemoDef = {
  id: string;
  question: string;
  controlLabel: string;
  options: DemoOption[];
  defaultLeft: string;
  defaultRight: string;
  variants: Record<string, FixturePair>;
  inputFile?: DemoInputFile;
};

export type LessonId = "Lesson 1" | "Lesson 2" | "Lesson 3";

export type AIExchange = {
  userMessage: string;
  aiLabel: string;
  aiDescription: string;
  aiCodeSnippet?: string;
};

export type ChatMode =
  | "model-picker"
  | "tool-toggles"
  | "agent-chat"
  | "code-gen"
  | "system-prompt"
  | "streaming"
  | "multi-turn"
  | "structured-output"
  | "self-correction"
  | "reflection"
  | "rules-toggle"
  | "inline-edit"
  | "codebase-search"
  | "planner"
  | "multi-agent-pipeline"
  | "human-in-the-loop"
  | "parallel-gen"
  | "time-travel";

export type ChatMessage = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, string>;
  renderAs?: "markdown" | "plain";
};

export type ModelOption = {
  id: string;
  label: string;
  description: string;
};

export type ToolOption = {
  id: string;
  name: string;
  enabled: boolean;
};

export type SystemPromptOption = {
  id: string;
  label: string;
  prompt: string;
};

export type TaskOption = {
  id: string;
  label: string;
  description: string;
};

export type CheckpointOption = {
  id: string;
  label: string;
  description: string;
};

export type GraphNodeDef = {
  id: string;
  label: string;
};

export type GraphEdgeDef = {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
};

export type GraphRunStep = {
  node: string;
  title: string;
  detail: string;
  status?: "pending" | "success" | "error" | "warning";
};

export type ChatConfig = {
  mode: ChatMode;
  models?: ModelOption[];
  tools?: ToolOption[];
  systemPrompts?: SystemPromptOption[];
  tasks?: TaskOption[];
  checkpoints?: CheckpointOption[];
  defaultPrompt?: string;
  conversations: Record<string, ChatMessage[]>;
  generatedFile?: { filename: string; content: string };
  turnFiles?: Record<string, { filename: string; content: string }>;
  initialCode?: { filename: string; content: string };
  terminalLogs?: Record<string, LogLine[]>;
  inlineEditPrompt?: string;
  graphVisualization?: boolean;
  graphNodes?: GraphNodeDef[];
  graphEdges?: GraphEdgeDef[];
  animationSequence?: string[];
  graphRunSteps?: Record<string, GraphRunStep[]>;
  rules?: string;
};

export type ChapterDef = {
  slug: string;
  number: number;
  lesson: LessonId;
  subtopicLabel?: string;
  title: string;
  subtitle: string;
  intro: string;
  takeaway: string;
  demos: DemoDef[];
  cursorFeature?: string;
  designPatterns?: string[];
  codeContent?: string;
  codeFilename?: string;
  backendCode?: string;
  backendFilename?: string;
  aiExchange?: AIExchange;
  chatConfig?: ChatConfig;
};
