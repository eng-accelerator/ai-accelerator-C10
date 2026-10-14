"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type GeneratedWorkspaceFile = {
  path: string;
  content: string;
  ownerSlug: string;
};

type WorkspaceContextValue = {
  generatedFiles: Record<string, GeneratedWorkspaceFile>;
  addGeneratedFile: (ownerSlug: string, path: string, content: string) => void;
  resetChapterFiles: (ownerSlug: string) => void;
  resetAllGeneratedFiles: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, GeneratedWorkspaceFile>>({});

  const addGeneratedFile = useCallback((ownerSlug: string, path: string, content: string) => {
    setGeneratedFiles((files) => ({
      ...files,
      [path]: { path, content, ownerSlug },
    }));
  }, []);

  const resetChapterFiles = useCallback((ownerSlug: string) => {
    setGeneratedFiles((files) =>
      Object.fromEntries(Object.entries(files).filter(([, file]) => file.ownerSlug !== ownerSlug))
    );
  }, []);

  const resetAllGeneratedFiles = useCallback(() => {
    setGeneratedFiles({});
  }, []);

  const value = useMemo(
    () => ({
      generatedFiles,
      addGeneratedFile,
      resetChapterFiles,
      resetAllGeneratedFiles,
    }),
    [addGeneratedFile, generatedFiles, resetAllGeneratedFiles, resetChapterFiles]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  return context!;
}
