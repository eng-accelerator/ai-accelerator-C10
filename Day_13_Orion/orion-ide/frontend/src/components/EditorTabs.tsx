import { X } from 'lucide-react';
import useStore from '../store/useStore';

const extensionColors: Record<string, string> = {
  ts: 'bg-blue-400',
  tsx: 'bg-blue-500',
  js: 'bg-yellow-400',
  jsx: 'bg-yellow-500',
  py: 'bg-green-400',
  json: 'bg-amber-400',
  css: 'bg-purple-400',
  html: 'bg-orange-400',
  md: 'bg-gray-400',
};

function getExtColor(filename: string): string {
  const ext = filename.split('.').pop() || '';
  return extensionColors[ext] || 'bg-orion-text-secondary';
}

export default function EditorTabs() {
  const { openFiles, activeFileIndex, closeFile, setActiveFile } = useStore();

  if (openFiles.length === 0) return <div />;

  return (
    <div className="flex items-center bg-orion-bg-secondary border-b border-orion-border overflow-x-auto scrollbar-thin">
      {openFiles.map((file, index) => {
        const isActive = index === activeFileIndex;
        const filename = file.path.split('/').pop() || file.path;

        return (
          <button
            key={file.path}
            onClick={() => setActiveFile(index)}
            className={`group flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-r border-orion-border min-w-0 transition-colors ${
              isActive
                ? 'bg-orion-bg-primary border-t-2 border-t-orion-accent-blue text-white'
                : 'bg-orion-bg-secondary text-orion-text-secondary hover:bg-orion-bg-tertiary border-t-2 border-t-transparent'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getExtColor(filename)}`} />
            <span className="truncate">{filename}</span>
            {file.modified && (
              <span className="w-2 h-2 rounded-full bg-orion-text-primary flex-shrink-0" />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeFile(index);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-orion-bg-input rounded p-0.5 flex-shrink-0 transition-opacity"
            >
              <X size={14} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
