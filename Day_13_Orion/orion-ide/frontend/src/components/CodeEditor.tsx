import { useState, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import useStore from '../store/useStore';
import { saveFile } from '../api/client';
import InlineEdit from './InlineEdit';

export default function CodeEditor() {
  const { openFiles, activeFileIndex, updateFileContent } = useStore();
  const [inlineEditVisible, setInlineEditVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 's') {
        e.preventDefault();
        if (activeFile) {
          saveFile(activeFile.path, activeFile.content);
        }
      }

      if (mod && e.key === 'k') {
        e.preventDefault();
        setInlineEditVisible(true);
      }
    },
    [activeFile]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleApplyInlineEdit = (newCode: string) => {
    if (activeFile) {
      const content = selectedCode
        ? activeFile.content.replace(selectedCode, newCode)
        : newCode;
      updateFileContent(activeFileIndex, content);
    }
    setInlineEditVisible(false);
  };

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-orion-bg-primary">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-orion-text-primary tracking-tight">Orion</h1>
          <p className="text-xl text-orion-text-secondary">AI Coding Agent</p>
          <div className="mt-8 space-y-2 text-sm text-orion-text-muted">
            <p>
              <kbd className="px-2 py-1 bg-orion-bg-tertiary border border-orion-border rounded text-xs text-orion-text-secondary">
                Ctrl+K
              </kbd>{' '}
              for inline edit
            </p>
            <p>
              <kbd className="px-2 py-1 bg-orion-bg-tertiary border border-orion-border rounded text-xs text-orion-text-secondary">
                Ctrl+S
              </kbd>{' '}
              to save file
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <Editor
        theme="vs-dark"
        language={activeFile.language}
        value={activeFile.content}
        onChange={(value) => updateFileContent(activeFileIndex, value || '')}
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: 'Menlo, Monaco, Consolas, monospace',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          padding: { top: 8 },
        }}
        onMount={(editor) => {
          editor.onDidChangeCursorSelection((e) => {
            const selection = editor.getModel()?.getValueInRange(e.selection);
            if (selection) setSelectedCode(selection);
          });
        }}
      />
      <InlineEdit
        visible={inlineEditVisible}
        onClose={() => setInlineEditVisible(false)}
        selectedCode={selectedCode}
        onApply={handleApplyInlineEdit}
      />
    </div>
  );
}
