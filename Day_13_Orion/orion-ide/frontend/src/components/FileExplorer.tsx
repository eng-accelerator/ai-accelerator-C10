import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText, FileJson } from 'lucide-react'
import useStore from '../store/useStore'
import { fetchFileContent } from '../api/client'
import { FileNode } from '../types'

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'py':
      return <FileCode size={14} className="text-yellow-400 shrink-0" />
    case 'js': case 'jsx':
      return <FileCode size={14} className="text-yellow-300 shrink-0" />
    case 'ts': case 'tsx':
      return <FileCode size={14} className="text-blue-400 shrink-0" />
    case 'json':
      return <FileJson size={14} className="text-yellow-500 shrink-0" />
    case 'css': case 'scss':
      return <FileCode size={14} className="text-pink-400 shrink-0" />
    case 'html':
      return <FileCode size={14} className="text-orange-400 shrink-0" />
    case 'md':
      return <FileText size={14} className="text-blue-300 shrink-0" />
    default:
      return <FileText size={14} className="text-orion-text-secondary shrink-0" />
  }
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const { openFile, openFiles, activeFileIndex } = useStore()

  const isActiveFile = openFiles[activeFileIndex]?.path === node.path

  const handleFileClick = async () => {
    if (node.is_directory) {
      setExpanded(!expanded)
      return
    }
    const data = await fetchFileContent(node.path)
    openFile(node.path, node.name, data.content || '')
  }

  return (
    <div>
      <div
        onClick={handleFileClick}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={`flex items-center gap-1.5 h-[26px] cursor-pointer text-[13px] pr-2 ${
          isActiveFile
            ? 'bg-orion-selection text-orion-text-primary'
            : 'hover:bg-orion-bg-tertiary text-orion-text-primary'
        }`}
      >
        {node.is_directory ? (
          <>
            {expanded
              ? <ChevronDown size={14} className="text-orion-text-secondary shrink-0" />
              : <ChevronRight size={14} className="text-orion-text-secondary shrink-0" />
            }
            {expanded
              ? <FolderOpen size={14} className="text-orion-text-secondary shrink-0" />
              : <Folder size={14} className="text-orion-text-secondary shrink-0" />
            }
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {node.is_directory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileExplorer() {
  const { files } = useStore()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center px-4 h-9 border-b border-orion-border">
        <span className="text-[11px] uppercase tracking-wider text-orion-text-secondary font-medium">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-orion-text-muted text-xs">No workspace open</p>
          </div>
        ) : (
          files.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
