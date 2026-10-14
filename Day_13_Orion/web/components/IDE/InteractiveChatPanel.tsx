"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Wrench, Cpu, ToggleLeft, ToggleRight, Zap, Shield, Hand, Clock, Play } from "lucide-react";
import type { ChatConfig, ChatMessage, GraphRunStep, LogLine } from "@/lib/schema";

type Props = {
  chatConfig: ChatConfig;
  onFileGenerated?: (filename: string, content: string) => void;
  onTerminalLogs?: (logs: LogLine[]) => void;
  onGraphReset?: () => void;
  onGraphStep?: (step: GraphRunStep) => void;
  resetKey?: number;
};

export function InteractiveChatPanel({
  chatConfig,
  onFileGenerated,
  onTerminalLogs,
  onGraphReset,
  onGraphStep,
  resetKey,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(chatConfig.defaultPrompt ?? "");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(
    chatConfig.systemPrompts?.[0]?.id ?? null
  );
  const [selectedTask, setSelectedTask] = useState<string | null>(
    chatConfig.tasks?.[0]?.id ?? chatConfig.checkpoints?.[0]?.id ?? null
  );
  const [selectedToggle, setSelectedToggle] = useState<string>(
    chatConfig.mode === "human-in-the-loop"
      ? "approve"
      : chatConfig.mode === "rules-toggle"
        ? "no_rules"
        : "raw"
  );
  const [toolStates, setToolStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    chatConfig.tools?.forEach((t) => { initial[t.id] = t.enabled; });
    return initial;
  });
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText, loading]);

  useEffect(() => {
    setMessages([]);
    setInput(chatConfig.defaultPrompt ?? "");
    setDisabled(false);
    setLoading(false);
    setSelectedModel(null);
    setSelectedPrompt(chatConfig.systemPrompts?.[0]?.id ?? null);
    setSelectedTask(chatConfig.tasks?.[0]?.id ?? chatConfig.checkpoints?.[0]?.id ?? null);
    setSelectedToggle(
      chatConfig.mode === "human-in-the-loop"
        ? "approve"
        : chatConfig.mode === "rules-toggle"
          ? "no_rules"
          : "raw"
    );
    setToolStates(() => {
      const initial: Record<string, boolean> = {};
      chatConfig.tools?.forEach((tool) => {
        initial[tool.id] = tool.enabled;
      });
      return initial;
    });
    setStreamingText(null);
    setTurnCount(0);
  }, [chatConfig, resetKey]);

  const getConversationKey = useCallback((): string => {
    switch (chatConfig.mode) {
      case "model-picker":
        return selectedModel ?? "default";
      case "tool-toggles": {
        return toolStates.list_directory ? "enabled" : "disabled";
      }
      case "system-prompt":
        return selectedPrompt ?? "default";
      case "multi-turn":
        return `turn_${turnCount + 1}`;
      case "structured-output":
        return selectedToggle;
      case "self-correction":
        return selectedTask ?? "default";
      case "rules-toggle":
      case "human-in-the-loop":
        return selectedToggle;
      case "time-travel":
        return selectedTask ?? "default";
      default:
        return "default";
    }
  }, [chatConfig.mode, selectedModel, toolStates, selectedPrompt, turnCount, selectedToggle, selectedTask]);

  const handleSend = useCallback(() => {
    if (!input.trim() || disabled || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    onGraphReset?.();
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const key = getConversationKey();
    const response = chatConfig.conversations[key] ?? chatConfig.conversations["default"] ?? [];
    const graphRunSteps = chatConfig.graphRunSteps?.[key] ?? (
      chatConfig.graphVisualization
        ? response
            .filter((message) => message.role === "tool")
            .map((message): GraphRunStep => ({
              node: message.toolName ?? "agent",
              title: message.toolArgs
                ? Object.entries(message.toolArgs).map(([arg, value]) => `${arg}: ${value}`).join(", ")
                : message.toolName ?? "tool",
              detail: message.content,
              status: message.toolArgs?.status === "FAILED"
                ? "error"
                : message.toolArgs?.status === "SUCCESS" || message.toolArgs?.approved === "true"
                  ? "success"
                  : undefined,
            }))
        : []
    );
    const chatResponse = chatConfig.graphVisualization
      && (chatConfig.mode === "self-correction" || chatConfig.mode === "reflection")
      ? response.filter((message) => message.role !== "tool")
      : response;
    const runFile = chatConfig.mode === "multi-turn" ? chatConfig.turnFiles?.[key] : chatConfig.generatedFile;
    const generatedPath = runFile
      ? runFile.filename.includes("/") ? runFile.filename : `generated/${runFile.filename}`
      : null;
    const fallbackTerminalLogs: LogLine[] = [
        { tag: "PROCESS", text: `[execute] ${chatConfig.mode} tutorial` },
        ...(generatedPath
          ? [
              { tag: "TOOL" as const, text: "mkdir -p generated" },
              { tag: "TOOL" as const, text: `write ${generatedPath}` },
            ]
          : []),
        { tag: "OK", text: generatedPath ? `created ${generatedPath}` : "completed tutorial run" },
      ];
    const terminalLogs = chatConfig.terminalLogs?.[key] ?? fallbackTerminalLogs;

    const thinkingDelay = 1200 + Math.random() * 800;
    onTerminalLogs?.([]);
    terminalLogs.forEach((_, index) => {
      setTimeout(() => {
        onTerminalLogs?.(terminalLogs.slice(0, index + 1));
      }, 300 + index * 350);
    });
    graphRunSteps.forEach((step, index) => {
      setTimeout(() => {
        onGraphStep?.(step);
      }, 300 + index * 350);
    });

    if (chatConfig.mode === "streaming") {
      setTimeout(() => {
        setLoading(false);
        const fullText = chatResponse
          .filter((m) => m.role === "assistant")
          .map((m) => m.content)
          .join("\n");

        let idx = 0;
        setStreamingText("");
        const interval = setInterval(() => {
          idx++;
          setStreamingText(fullText.slice(0, idx));
          if (idx >= fullText.length) {
            clearInterval(interval);
            setStreamingText(null);
            setMessages((prev) => [...prev, ...chatResponse]);
            setDisabled(true);
          }
        }, 25);
      }, thinkingDelay);
    } else {
      setTimeout(() => {
        setLoading(false);
        setMessages((prev) => [...prev, ...chatResponse]);

        if ((chatConfig.mode === "code-gen" || chatConfig.mode === "inline-edit") && chatConfig.generatedFile) {
          onFileGenerated?.(chatConfig.generatedFile.filename, chatConfig.generatedFile.content);
        }

        if (chatConfig.mode === "self-correction" && selectedTask === "easy" && chatConfig.generatedFile) {
          onFileGenerated?.(chatConfig.generatedFile.filename, chatConfig.generatedFile.content);
        }

        if (chatConfig.mode === "multi-agent-pipeline" && chatConfig.generatedFile) {
          onFileGenerated?.(chatConfig.generatedFile.filename, chatConfig.generatedFile.content);
        }

        if (chatConfig.mode === "human-in-the-loop" && selectedToggle === "approve" && chatConfig.generatedFile) {
          onFileGenerated?.(chatConfig.generatedFile.filename, chatConfig.generatedFile.content);
        }

        if (chatConfig.mode === "parallel-gen" && chatConfig.generatedFile) {
          onFileGenerated?.(chatConfig.generatedFile.filename, chatConfig.generatedFile.content);
        }

        const reusableModes: string[] = ["system-prompt", "structured-output", "self-correction", "rules-toggle", "codebase-search", "human-in-the-loop", "time-travel"];
        if (reusableModes.includes(chatConfig.mode)) {
          setInput(chatConfig.defaultPrompt ?? "");
        } else if (chatConfig.mode === "multi-turn") {
          const turnFile = chatConfig.turnFiles?.[key];
          if (turnFile) {
            onFileGenerated?.(turnFile.filename, turnFile.content);
          }
          setTurnCount((c) => c + 1);
          if (turnCount >= 1) {
            setDisabled(true);
          } else {
            setInput("Now read the logger.py file and add these features:\n- Log levels: INFO, WARNING, ERROR\n- A method to filter logs by level\nWrite the updated file.");
          }
        } else {
          setDisabled(true);
        }
      }, thinkingDelay);
    }
  }, [input, disabled, loading, getConversationKey, chatConfig, onGraphReset, onGraphStep, onFileGenerated, onTerminalLogs, selectedTask, selectedToggle, turnCount]);

  return (
    <aside className="w-96 bg-surface-container-low border-l border-outline-variant flex flex-col shrink-0">
      <div className="p-3 flex items-center gap-2 border-b border-outline-variant/20">
        <Bot className="w-5 h-5 text-ink" />
        <span className="font-headline text-[18px] font-semibold tracking-tight text-ink">
          AI ASSISTANT
        </span>
      </div>

      {chatConfig.mode === "tool-toggles" && chatConfig.tools && (
        <ToolToggleSection
          tools={chatConfig.tools}
          states={toolStates}
          onToggle={(id) => setToolStates((s) => ({ ...s, [id]: !s[id] }))}
        />
      )}

      {chatConfig.mode === "system-prompt" && chatConfig.systemPrompts && (
        <SystemPromptSection
          prompts={chatConfig.systemPrompts}
          selected={selectedPrompt}
          onSelect={setSelectedPrompt}
        />
      )}

      {chatConfig.mode === "structured-output" && (
        <ToggleSection
          label="OUTPUT MODE"
          icon={<Zap className="w-4 h-4 text-primary" />}
          options={[
            { id: "raw", label: "Raw" },
            { id: "structured", label: "Structured" },
          ]}
          selected={selectedToggle}
          onSelect={setSelectedToggle}
        />
      )}

      {chatConfig.mode === "self-correction" && chatConfig.tasks && (
        <TaskPickerSection
          tasks={chatConfig.tasks}
          selected={selectedTask}
          onSelect={setSelectedTask}
        />
      )}

      {chatConfig.mode === "rules-toggle" && (
        <div className="border-b border-outline-variant/20">
          <ToggleSection
            label="CODING RULES"
            icon={<Shield className="w-4 h-4 text-primary" />}
            options={[
              { id: "no_rules", label: "No rules" },
              { id: "strict", label: "tests.mdc" },
            ]}
            selected={selectedToggle}
            onSelect={setSelectedToggle}
            hasBorder={false}
          />
          {selectedToggle === "strict" && chatConfig.rules && (
            <div className="mx-3 mb-3 max-h-32 overflow-y-auto rounded border border-outline-variant/30 bg-surface-low p-2">
              <p className="font-code text-[10px] leading-4 text-ink-variant whitespace-pre-wrap">
                {chatConfig.rules}
              </p>
            </div>
          )}
        </div>
      )}

      {chatConfig.mode === "human-in-the-loop" && (
        <ToggleSection
          label="HUMAN DECISION"
          icon={<Hand className="w-4 h-4 text-primary" />}
          options={[
            { id: "approve", label: "Approve" },
            { id: "reject", label: "Reject" },
          ]}
          selected={selectedToggle}
          onSelect={setSelectedToggle}
        />
      )}

      {chatConfig.mode === "time-travel" && chatConfig.checkpoints && (
        <CheckpointPickerSection
          checkpoints={chatConfig.checkpoints}
          selected={selectedTask}
          onSelect={setSelectedTask}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                <Bot className="w-3 h-3 text-night" />
              </div>
              <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink animate-pulse">
                THINKING...
              </span>
            </div>
            <div className="bg-surface-low p-3 rounded border border-outline-variant">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-ink-variant/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-ink-variant/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-ink-variant/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {streamingText !== null && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
                <Bot className="w-3 h-3 text-night" />
              </div>
              <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink">
                STREAMING
              </span>
            </div>
            <div className="bg-surface-low p-3 rounded border border-outline-variant">
              <p className="font-code text-[12px] text-ink-variant whitespace-pre-wrap">
                {streamingText}
                <span className="animate-pulse inline-block w-1.5 h-3 bg-primary ml-0.5" />
              </p>
            </div>
          </div>
        )}
        {messages.length === 0 && streamingText === null && !loading && (
          <div className="flex items-center justify-center h-full text-ink-variant text-[12px] opacity-50">
            Send a message to interact with the agent
          </div>
        )}
      </div>

      <div className="p-3 border-t border-outline-variant bg-surface-container-low">
        {chatConfig.mode === "model-picker" && chatConfig.models && (
          <ModelPickerSection
            models={chatConfig.models}
            selected={selectedModel}
            onSelect={setSelectedModel}
          />
        )}
        <div className="bg-surface-low rounded border border-outline-variant focus-within:border-ink transition-all overflow-hidden">
          <textarea
            className="w-full bg-transparent border-none focus:outline-none text-[12px] p-2 resize-none h-16 text-ink placeholder-ink-variant/30 font-body"
            placeholder={disabled ? "Session complete" : loading ? "Waiting for response..." : "Type your message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={disabled || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-end p-2 bg-surface-low">
            <button
              onClick={handleSend}
              disabled={disabled || loading || !input.trim()}
              className="bg-ink text-night h-7 px-3 rounded text-[10px] font-bold uppercase hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              {loading ? "..." : "EXECUTE"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ToggleSection({
  label,
  icon,
  options,
  selected,
  onSelect,
  hasBorder = true,
}: {
  label: string;
  icon: React.ReactNode;
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  hasBorder?: boolean;
}) {
  return (
    <div className={`p-3 space-y-2 ${hasBorder ? "border-b border-outline-variant/20" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
          {label}
        </span>
      </div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
              selected === o.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant/30 text-ink-variant hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskPickerSection({
  tasks,
  selected,
  onSelect,
}: {
  tasks: { id: string; label: string; description: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="p-3 border-b border-outline-variant/20 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-primary" />
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
          SELECT TASK
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left p-2 rounded border transition-all ${
              selected === t.id
                ? "border-primary bg-primary/10 text-ink"
                : "border-outline-variant/30 bg-surface-low text-ink-variant hover:border-ink-variant"
            }`}
          >
            <div className="font-headline text-[11px] font-bold">{t.label}</div>
            <div className="font-body text-[10px] opacity-70">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckpointPickerSection({
  checkpoints,
  selected,
  onSelect,
}: {
  checkpoints: { id: string; label: string; description: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="p-3 border-b border-outline-variant/20 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-primary" />
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
          CHECKPOINT
        </span>
      </div>
      <div className="space-y-1.5">
        {checkpoints.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-2 rounded border transition-all ${
              selected === c.id
                ? "border-primary bg-primary/10 text-ink"
                : "border-outline-variant/30 bg-surface-low text-ink-variant hover:border-ink-variant"
            }`}
          >
            <div className="font-headline text-[11px] font-bold">{c.label}</div>
            <div className="font-body text-[10px] opacity-70">{c.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModelPickerSection({
  models,
  selected,
  onSelect,
}: {
  models: { id: string; label: string; description: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <label className="mb-2 block space-y-1.5">
      <div className="flex items-center gap-2">
        <Cpu className="w-4 h-4 text-primary" />
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
          SELECT MODEL
        </span>
      </div>
      <select
        value={selected ?? ""}
        onChange={(event) => onSelect(event.target.value || null)}
        className="h-8 w-full rounded border border-outline-variant bg-surface-low px-2 font-body text-[12px] text-ink outline-none transition-colors focus:border-ink"
      >
        <option value="">Default model</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolToggleSection({
  tools,
  states,
  onToggle,
}: {
  tools: { id: string; name: string }[];
  states: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="p-3 border-b border-outline-variant/20 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="w-4 h-4 text-primary" />
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
          AVAILABLE TOOLS
        </span>
      </div>
      <div className="space-y-1.5">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => onToggle(t.id)}
            className="w-full flex items-center justify-between p-2 rounded border border-outline-variant/30 bg-surface-low hover:border-ink-variant transition-all"
          >
            <span className="font-code text-[11px] text-ink">{t.name}</span>
            {states[t.id] ? (
              <ToggleRight className="w-5 h-5 text-primary" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-ink-variant/50" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SystemPromptSection({
  prompts,
  selected,
  onSelect,
}: {
  prompts: { id: string; label: string; prompt: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="p-3 border-b border-outline-variant/20 space-y-2">
      <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink-variant">
        SYSTEM PROMPT
      </span>
      <div className="flex gap-1">
        {prompts.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
              selected === p.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant/30 text-ink-variant hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="p-2 bg-surface-low rounded border border-outline-variant/30 max-h-24 overflow-y-auto">
          <p className="font-code text-[10px] text-ink-variant whitespace-pre-wrap">
            {prompts.find((p) => p.id === selected)?.prompt}
          </p>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="bg-surface-high p-2 px-3 rounded border border-outline-variant/30 max-w-[90%]">
          <p className="font-body text-[12px] text-ink whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.role === "tool") {
    return (
      <div className="flex flex-col gap-1">
        <div className="bg-surface-hover/50 p-2 rounded border border-outline-variant/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Wrench className="w-3 h-3 text-primary" />
            <span className="font-headline text-[9px] font-bold tracking-wider uppercase text-primary">
              {message.toolName}
            </span>
          </div>
          {message.toolArgs && (
            <div className="font-code text-[10px] text-ink-variant mb-1">
              {Object.entries(message.toolArgs).map(([k, v]) => (
                <div key={k}><span className="text-code-keyword">{k}</span>: {v}</div>
              ))}
            </div>
          )}
          <div className="font-code text-[10px] text-ink whitespace-pre-wrap border-t border-outline-variant/30 pt-1 mt-1">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center">
          <Bot className="w-3 h-3 text-night" />
        </div>
        <span className="font-headline text-[10px] font-bold tracking-wider uppercase text-ink">
          ASSISTANT
        </span>
      </div>
      <div className="bg-surface-low p-3 rounded border border-outline-variant">
        <AssistantContent content={message.content} renderAs={message.renderAs} />
      </div>
    </div>
  );
}

function AssistantContent({
  content,
  renderAs = "markdown",
}: {
  content: string;
  renderAs?: ChatMessage["renderAs"];
}) {
  if (renderAs === "plain") {
    return (
      <pre className="whitespace-pre-wrap font-code text-[11px] leading-5 text-ink-variant">
        {content}
      </pre>
    );
  }

  const blocks = content.split(/```(?:\w+)?\n([\s\S]*?)```/g);

  return (
    <div className="space-y-2 font-body text-[12px] text-ink-variant">
      {blocks.map((block, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            className="overflow-x-auto rounded border border-outline-variant/40 bg-night p-2 font-code text-[11px] leading-5 text-ink"
          >
            <code>{block.trimEnd()}</code>
          </pre>
        ) : (
          block.trim() && (
            <p key={index} className="whitespace-pre-wrap">
              {block.trim()}
            </p>
          )
        )
      )}
    </div>
  );
}
