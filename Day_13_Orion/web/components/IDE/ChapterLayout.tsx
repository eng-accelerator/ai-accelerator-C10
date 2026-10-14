"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { IDEHeader } from "./IDEHeader";
import { ActivityBar, type ActivityView } from "./ActivityBar";
import { FileExplorer, TutorialExplorer } from "./FileExplorer";
import { CodePanel } from "./CodePanel";
import { InteractiveChatPanel } from "./InteractiveChatPanel";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { StatusFooter } from "./StatusFooter";
import { TerminalLogPanel } from "./TerminalLogPanel";
import { AgentGraphVisualizer } from "./AgentGraphVisualizer";
import { useWorkspace } from "@/lib/WorkspaceContext";
import type { ChapterDef, GraphRunStep, LogLine, WorkspaceFile } from "@/lib/schema";

const SAMPLE_PROJECT_FILES: Record<string, string> = {
  "sample_project/app.py": `import streamlit as st
from chat import get_client, stream_response
from config import PAGE_ICON, PAGE_TITLE, AVAILABLE_MODELS

st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON)
st.title(f"{PAGE_ICON} {PAGE_TITLE}")

api_key = st.sidebar.text_input("OpenRouter API Key", type="password")

if "messages" not in st.session_state:
    st.session_state.messages = []

selected_model = st.sidebar.selectbox("Select Model", options=AVAILABLE_MODELS)

if not api_key:
    st.warning("Enter your OpenRouter API key to start.")
    st.stop()

client = get_client(api_key)

if prompt := st.chat_input("Ask me anything..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    response = st.write_stream(stream_response(client, st.session_state.messages, selected_model))
    st.session_state.messages.append({"role": "assistant", "content": response})`,
  "sample_project/chat.py": `from openai import OpenAI
from config import BASE_URL


def get_client(api_key: str) -> OpenAI:
    """Create and return an OpenAI client configured for OpenRouter."""
    return OpenAI(base_url=BASE_URL, api_key=api_key)


def stream_response(client: OpenAI, messages: list, model: str):
    """Stream chat completion responses from the API."""
    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        if chunk.choices[0].delta.content is not None:
            yield chunk.choices[0].delta.content`,
  "sample_project/config.py": `PAGE_TITLE = "My ChatBot"
PAGE_ICON = "Bot"
MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"
AVAILABLE_MODELS = [
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
]`,
};

function createInitialWorkspace(chapter: ChapterDef): Record<string, WorkspaceFile> {
  const files = Object.fromEntries(
    Object.entries(SAMPLE_PROJECT_FILES).map(([path, content]) => [
      path,
      { path, content },
    ])
  );

  if (chapter.backendCode && chapter.backendFilename) {
    const path = `orion/${chapter.backendFilename}`;
    files[path] = { path, content: chapter.backendCode };
  }

  if (chapter.chatConfig?.initialCode) {
    const path = `generated/${chapter.chatConfig.initialCode.filename}`;
    files[path] = { path, content: chapter.chatConfig.initialCode.content };
  }

  return files;
}

function toGeneratedPath(filename: string): string {
  return filename.includes("/") ? filename : `generated/${filename}`;
}

type ChapterLayoutProps = {
  chapter: ChapterDef;
  defaultView?: ActivityView;
};

export function ChapterLayout({ chapter, defaultView = "tutorials" }: ChapterLayoutProps) {
  const {
    generatedFiles,
    addGeneratedFile,
    resetChapterFiles,
    resetAllGeneratedFiles,
  } = useWorkspace();
  const initialCode = chapter.chatConfig?.initialCode ?? null;
  const initialWorkspace = useMemo(() => createInitialWorkspace(chapter), [chapter]);
  const globalWorkspaceFiles = useMemo(
    () =>
      Object.fromEntries(
        Object.values(generatedFiles).map((file) => [file.path, { path: file.path, content: file.content }])
      ),
    [generatedFiles]
  );
  const [dynamicFile, setDynamicFile] = useState<{ filename: string; content: string } | null>(
    initialCode ? { filename: toGeneratedPath(initialCode.filename), content: initialCode.content } : null
  );
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, WorkspaceFile>>({
    ...initialWorkspace,
    ...globalWorkspaceFiles,
  });
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<LogLine[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [activeView, setActiveView] = useState<ActivityView>(defaultView);
  const [graphActiveNode, setGraphActiveNode] = useState<string | null>(null);
  const [graphSteps, setGraphSteps] = useState<GraphRunStep[]>([]);

  useEffect(() => {
    setWorkspaceFiles({
      ...initialWorkspace,
      ...globalWorkspaceFiles,
    });
  }, [globalWorkspaceFiles, initialWorkspace]);

  useEffect(() => {
    setDynamicFile(initialCode ? { filename: toGeneratedPath(initialCode.filename), content: initialCode.content } : null);
    setSelectedFilePath(null);
    setTerminalLogs([]);
    setGraphActiveNode(null);
    setGraphSteps([]);
  }, [chapter.slug, initialCode]);

  const handleFileGenerated = useCallback((filename: string, content: string) => {
    const path = toGeneratedPath(filename);
    setDynamicFile({ filename: path, content });
    setSelectedFilePath(path);
    addGeneratedFile(chapter.slug, path, content);
    setWorkspaceFiles((files) => ({
      ...files,
      [path]: { path, content },
    }));
  }, [addGeneratedFile, chapter.slug]);

  const handleReset = useCallback(() => {
    const remainingGeneratedFiles = Object.fromEntries(
      Object.values(generatedFiles)
        .filter((file) => file.ownerSlug !== chapter.slug)
        .map((file) => [file.path, { path: file.path, content: file.content }])
    );

    resetChapterFiles(chapter.slug);
    setWorkspaceFiles({
      ...initialWorkspace,
      ...remainingGeneratedFiles,
    });
    setDynamicFile(initialCode ? { filename: toGeneratedPath(initialCode.filename), content: initialCode.content } : null);
    setSelectedFilePath(null);
    setTerminalLogs([]);
    setResetKey((key) => key + 1);
    setGraphActiveNode(null);
    setGraphSteps([]);
  }, [chapter.slug, generatedFiles, initialCode, initialWorkspace, resetChapterFiles]);

  const handleProjectReset = useCallback(() => {
    resetAllGeneratedFiles();
    setWorkspaceFiles(initialWorkspace);
    setDynamicFile(initialCode ? { filename: toGeneratedPath(initialCode.filename), content: initialCode.content } : null);
    setSelectedFilePath(null);
    setTerminalLogs([]);
    setResetKey((key) => key + 1);
    setGraphActiveNode(null);
    setGraphSteps([]);
  }, [initialCode, initialWorkspace, resetAllGeneratedFiles]);

  const handleGraphReset = useCallback(() => {
    setGraphActiveNode(null);
    setGraphSteps([]);
  }, []);

  const handleGraphStep = useCallback((step: GraphRunStep) => {
    setGraphActiveNode(step.node);
    setGraphSteps((steps) => [...steps, step]);
  }, []);

  const handleStaticExecute = useCallback(() => {
    const targetFile = chapter.backendFilename
      ? `orion/${chapter.backendFilename}`
      : chapter.codeFilename
        ? `generated/${chapter.codeFilename}`
        : `${chapter.slug.replace(/-/g, "_")}.py`;
    setTerminalLogs([
      { tag: "PROCESS", text: `[execute] ${chapter.slug} tutorial` },
      { tag: "TOOL", text: `open ${targetFile}` },
      { tag: "OK", text: "completed tutorial run" },
    ]);
  }, [chapter.backendFilename, chapter.codeFilename, chapter.slug]);

  const filename = chapter.codeFilename ?? chapter.slug.replace(/-/g, "_") + ".py";
  const code = chapter.codeContent ?? "";
  const isInlineEdit = chapter.chatConfig?.mode === "inline-edit";

  const hasInteractiveChat = !!chapter.chatConfig && !isInlineEdit;
  const shouldShowEmptyPanel = hasInteractiveChat && !code && !dynamicFile;
  const selectedWorkspaceFile = selectedFilePath ? workspaceFiles[selectedFilePath] : null;
  const visibleFile = selectedWorkspaceFile
    ? { filename: selectedWorkspaceFile.path, content: selectedWorkspaceFile.content }
    : dynamicFile;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-night text-ink">
      <IDEHeader onReset={handleReset} onResetAll={handleProjectReset} />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar activeView={activeView} onSelectView={setActiveView} />
        {activeView === "tutorials" ? (
          <TutorialExplorer />
        ) : (
          <FileExplorer
            files={Object.values(workspaceFiles)}
            selectedFilePath={selectedFilePath}
            onSelectFile={setSelectedFilePath}
          />
        )}
        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {chapter.chatConfig?.graphVisualization && (
              <AgentGraphVisualizer
                nodes={chapter.chatConfig.graphNodes}
                edges={chapter.chatConfig.graphEdges}
                activeNode={graphActiveNode}
                steps={graphSteps}
              />
            )}
            <CodePanel
              code={shouldShowEmptyPanel ? undefined : code}
              filename={shouldShowEmptyPanel ? undefined : filename}
              backendCode={chapter.backendCode}
              backendFilename={chapter.backendFilename}
              dynamicFile={visibleFile}
              inlineEditConfig={
                isInlineEdit
                  ? {
                      prompt: chapter.chatConfig?.inlineEditPrompt,
                      generatedFile: chapter.chatConfig?.generatedFile,
                      onApply: handleFileGenerated,
                      onTerminalLogs: setTerminalLogs,
                    }
                  : undefined
              }
              resetKey={resetKey}
            />
            <TerminalLogPanel logs={terminalLogs} />
            <StatusFooter />
          </div>
          {hasInteractiveChat ? (
            <InteractiveChatPanel
              chatConfig={chapter.chatConfig!}
              onFileGenerated={handleFileGenerated}
              onTerminalLogs={setTerminalLogs}
              onGraphReset={handleGraphReset}
              onGraphStep={handleGraphStep}
              resetKey={resetKey}
            />
          ) : !isInlineEdit ? (
            <AIAssistantPanel exchange={chapter.aiExchange} onExecute={handleStaticExecute} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
