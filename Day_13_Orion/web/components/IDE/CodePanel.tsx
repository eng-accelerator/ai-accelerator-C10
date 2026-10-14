"use client";

import { useEffect, useState } from "react";
import { X, BarChart3, ArrowUp, Loader2 } from "lucide-react";

type LineSelection = {
  start: number;
  end: number;
};

type InlineEditConfig = {
  prompt?: string;
  generatedFile?: { filename: string; content: string };
  onApply: (filename: string, content: string) => void;
  onTerminalLogs?: (logs: { tag: "PROCESS" | "TOOL" | "OK"; text: string }[]) => void;
};

function highlightPython(
  code: string,
  selection?: LineSelection | null,
  onLineClick?: (line: number) => void
): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const lineNumber = i + 1;
    const isSelected =
      !!selection && lineNumber >= selection.start && lineNumber <= selection.end;

    return (
    <div
      key={i}
      className={`flex ${isSelected ? "bg-primary/15 outline outline-1 outline-primary/30" : ""} ${
        onLineClick ? "cursor-text" : ""
      }`}
      onClick={() => onLineClick?.(lineNumber)}
    >
      <span className="w-10 text-ink-variant/20 text-right pr-4 select-none font-code text-[11px] shrink-0">
        {lineNumber}
      </span>
      <span className="flex-1 whitespace-pre">
        <PythonLine line={line} />
      </span>
    </div>
    );
  });
}

function PythonLine({ line }: { line: string }) {
  if (line.trim().startsWith("#") || line.trim().startsWith("@")) {
    return <span className="text-code-comment">{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  const remaining = line;
  let keyIdx = 0;

  const keywords = /\b(from|import|def|return|with|as|if|else|elif|for|in|class|async|await|try|except|raise|not|and|or|True|False|None)\b/g;
  const strings = /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*'|f"[^"]*"|f'[^']*')/g;

  const tokens: { start: number; end: number; type: "keyword" | "string" | "func" }[] = [];

  let m: RegExpExecArray | null;
  while ((m = strings.exec(remaining)) !== null) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: "string" });
  }
  while ((m = keywords.exec(remaining)) !== null) {
    const overlaps = tokens.some((t) => m!.index >= t.start && m!.index < t.end);
    if (!overlaps) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: "keyword" });
    }
  }

  const funcMatch = /\bdef\s+(\w+)/g;
  while ((m = funcMatch.exec(remaining)) !== null) {
    tokens.push({ start: m.index + 4, end: m.index + 4 + m[1].length, type: "func" });
  }

  tokens.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) continue;
    if (token.start > cursor) {
      parts.push(<span key={keyIdx++}>{remaining.slice(cursor, token.start)}</span>);
    }
    const cls =
      token.type === "keyword"
        ? "text-code-keyword"
        : token.type === "string"
          ? "text-code-string"
          : "text-code-func";
    parts.push(
      <span key={keyIdx++} className={cls}>
        {remaining.slice(token.start, token.end)}
      </span>
    );
    cursor = token.end;
  }
  if (cursor < remaining.length) {
    parts.push(<span key={keyIdx++}>{remaining.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

export function CodePanel({
  code,
  filename,
  backendCode,
  backendFilename,
  dynamicFile,
  inlineEditConfig,
  resetKey,
}: {
  code?: string;
  filename?: string;
  backendCode?: string;
  backendFilename?: string;
  dynamicFile?: { filename: string; content: string } | null;
  inlineEditConfig?: InlineEditConfig;
  resetKey?: number;
}) {
  const [view, setView] = useState<"example" | "backend">("example");
  const [selection, setSelection] = useState<LineSelection | null>(
    inlineEditConfig ? { start: 1, end: 4 } : null
  );
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [editInput, setEditInput] = useState(inlineEditConfig?.prompt ?? "");
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);

  const hasDynamic = dynamicFile && dynamicFile.content;
  const hasStatic = code && code.trim();

  const activeCode = hasDynamic
    ? dynamicFile.content
    : view === "backend" && backendCode
      ? backendCode
      : code ?? "";
  const activeFilename = hasDynamic
    ? dynamicFile.filename
    : view === "backend" && backendFilename
      ? backendFilename
      : filename ?? "";

  const isEmpty = !hasDynamic && !hasStatic;
  const isInlineEdit = !!inlineEditConfig;

  useEffect(() => {
    if (!inlineEditConfig) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelection((current) => current ?? { start: 1, end: Math.min(4, activeCode.split("\n").length) });
        setShowInlineEdit(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCode, inlineEditConfig]);

  useEffect(() => {
    setView("example");
    setSelection(inlineEditConfig ? { start: 1, end: Math.min(4, activeCode.split("\n").length) } : null);
    setShowInlineEdit(false);
    setEditInput(inlineEditConfig?.prompt ?? "");
    setIsApplyingEdit(false);
  }, [activeCode, inlineEditConfig, resetKey]);

  const applyInlineEdit = () => {
    if (!inlineEditConfig?.generatedFile || !editInput.trim() || isApplyingEdit) return;

    setIsApplyingEdit(true);
    const path = `generated/${inlineEditConfig.generatedFile.filename}`;
    inlineEditConfig.onTerminalLogs?.([
      { tag: "PROCESS", text: "[inline-edit] apply selected edit" },
      { tag: "TOOL", text: `write ${path}` },
    ]);
    setTimeout(() => {
      inlineEditConfig.onApply(
        inlineEditConfig.generatedFile!.filename,
        inlineEditConfig.generatedFile!.content
      );
      inlineEditConfig.onTerminalLogs?.([
        { tag: "PROCESS", text: "[inline-edit] apply selected edit" },
        { tag: "TOOL", text: `write ${path}` },
        { tag: "OK", text: `updated ${path}` },
      ]);
      setIsApplyingEdit(false);
      setShowInlineEdit(false);
    }, 800);
  };

  return (
    <section className="flex-1 flex flex-col bg-night min-w-0">
      <div className="flex bg-surface-container-low border-b border-outline-variant h-9 shrink-0">
        {!isEmpty && (
          <div className="px-3 flex items-center gap-2 bg-night border-r border-outline-variant">
            <span className="font-headline text-[10px] font-bold tracking-wider text-white">
              {activeFilename}
            </span>
            <X className="w-3 h-3 text-ink-variant hover:text-ink cursor-pointer" />
          </div>
        )}

        {!hasDynamic && backendCode && (
          <div className="ml-auto flex items-center gap-0 mr-3">
            <button
              onClick={() => setView("example")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-l border border-outline-variant transition-colors ${
                view === "example"
                  ? "bg-white text-night"
                  : "bg-transparent text-ink-variant hover:text-ink"
              }`}
            >
              Example
            </button>
            <button
              onClick={() => setView("backend")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-r border border-l-0 border-outline-variant transition-colors ${
                view === "backend"
                  ? "bg-primary text-white"
                  : "bg-transparent text-ink-variant hover:text-ink"
              }`}
            >
              Backend
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 font-code text-[13px] leading-[20px] relative">
        {isEmpty ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-ink-variant/40 space-y-2">
              <BarChart3 className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-[12px] font-body">Run the agent to see generated code here</p>
            </div>
          </div>
        ) : (
          <>
            {isInlineEdit && showInlineEdit && selection && (
              <div className="absolute top-3 left-14 right-12 z-10 rounded-md border border-outline-variant bg-surface-low shadow-xl overflow-hidden">
                <div className="flex items-center">
                  <input
                    className="flex-1 bg-transparent px-3 py-2 font-body text-[12px] text-ink outline-none placeholder-ink-variant/40"
                    placeholder="Edit selected code"
                    value={editInput}
                    onChange={(event) => setEditInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyInlineEdit();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    className="p-2 text-ink-variant hover:text-ink"
                    onClick={() => setShowInlineEdit(false)}
                    aria-label="Close inline edit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-outline-variant/30 px-2 py-1.5">
                  <span className="font-code text-[10px] text-ink-variant">
                    Command+K inline edit
                  </span>
                  <button
                    className="flex items-center gap-1.5 rounded bg-ink px-2 py-1 text-[10px] font-bold uppercase text-night disabled:opacity-40"
                    onClick={applyInlineEdit}
                    disabled={isApplyingEdit || !editInput.trim()}
                  >
                    {isApplyingEdit ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )}
                    {isApplyingEdit ? "Editing" : "Edit Selection"}
                  </button>
                </div>
              </div>
            )}
            <div className={`text-ink ${isInlineEdit && showInlineEdit ? "pt-16" : ""}`}>
              {highlightPython(
                activeCode,
                isInlineEdit ? selection : null,
                isInlineEdit
                  ? (lineNumber) => {
                      setSelection({ start: lineNumber, end: lineNumber });
                    }
                  : undefined
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
