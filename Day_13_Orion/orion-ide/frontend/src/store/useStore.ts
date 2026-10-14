import { create } from 'zustand'
import { FileNode, OpenFile, ChatMessage, AgentTask, PendingReview, Checkpoint, ModelInfo } from '../types'

// The key lives in the browser only. With "remember" on it is kept in
// localStorage so a page reload does not ask again; it is never written to disk
// by the backend.
const KEY_STORAGE = 'orion.apiKey'

function loadStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

function storeKey(key: string, remember: boolean) {
  try {
    if (remember && key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* private mode or storage disabled: the key still works for this tab */
  }
}

interface AppState {
  apiKey: string
  setApiKey: (key: string, remember?: boolean) => void
  rememberKey: boolean
  serverHasKey: boolean
  setServerHasKey: (has: boolean) => void
  keyLabel: string
  setKeyLabel: (label: string) => void
  keySetupOpen: boolean
  setKeySetupOpen: (open: boolean) => void
  selectedModel: string
  setSelectedModel: (model: string) => void
  availableModels: ModelInfo[]
  setAvailableModels: (models: ModelInfo[]) => void

  sidebarView: 'files' | 'agent' | 'rules' | 'skills' | 'timetravel'
  setSidebarView: (view: 'files' | 'agent' | 'rules' | 'skills' | 'timetravel') => void
  sidebarOpen: boolean
  toggleSidebar: () => void

  files: FileNode[]
  setFiles: (files: FileNode[]) => void
  openFiles: OpenFile[]
  activeFileIndex: number
  openFile: (path: string, name: string, content: string) => void
  closeFile: (index: number) => void
  setActiveFile: (index: number) => void
  updateFileContent: (index: number, content: string) => void

  chatMessages: ChatMessage[]
  addChatMessage: (msg: Partial<ChatMessage> & { role: string; content: string }) => void
  appendToLastMessage: (content: string) => void
  clearChat: () => void
  chatLoading: boolean
  setChatLoading: (loading: boolean) => void

  terminalHistory: string[]
  addTerminalOutput: (output: string) => void
  clearTerminal: () => void
  terminalVisible: boolean
  toggleTerminal: () => void

  agentStatus: 'idle' | 'planning' | 'coding' | 'reviewing' | 'waiting_approval' | 'applying' | 'testing' | 'verifying' | 'done' | 'error'
  setAgentStatus: (status: AppState['agentStatus']) => void
  agentError: string | null
  setAgentError: (message: string | null) => void
  agentPlan: string | null
  setAgentPlan: (plan: string | null) => void
  agentTasks: AgentTask[]
  setAgentTasks: (tasks: AgentTask[] | ((prev: AgentTask[]) => AgentTask[])) => void
  pendingReview: PendingReview | null
  setPendingReview: (review: PendingReview | null) => void
  reviewHidden: boolean
  setReviewHidden: (hidden: boolean) => void
  threadId: string
  setThreadId: (id: string) => void

  checkpoints: Checkpoint[]
  setCheckpoints: (checkpoints: Checkpoint[]) => void

  loadedSkills: string[]
  addLoadedSkill: (name: string) => void
  clearLoadedSkills: () => void
  testOutput: string | null
  setTestOutput: (output: string | null) => void

  chatPanelOpen: boolean
  toggleChatPanel: () => void
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    py: 'python', js: 'javascript', ts: 'typescript', tsx: 'typescriptreact',
    jsx: 'javascriptreact', json: 'json', md: 'markdown', css: 'css',
    html: 'html', yml: 'yaml', yaml: 'yaml', sh: 'shell', txt: 'plaintext'
  }
  return map[ext || ''] || 'plaintext'
}

const storedKey = loadStoredKey()

// The thread id survives a page reload (sessionStorage) so a run that is paused
// at the human gate can be picked up again instead of being orphaned.
const THREAD_STORAGE = 'orion.threadId'

function loadThreadId(): string {
  try {
    return sessionStorage.getItem(THREAD_STORAGE) || `thread-${Date.now()}`
  } catch {
    return `thread-${Date.now()}`
  }
}

const useStore = create<AppState>((set, get) => ({
  apiKey: storedKey,
  rememberKey: Boolean(storedKey),
  setApiKey: (key, remember = get().rememberKey) => {
    storeKey(key, remember)
    set({ apiKey: key, rememberKey: remember })
  },
  serverHasKey: false,
  setServerHasKey: (has) => set({ serverHasKey: has }),
  keyLabel: '',
  setKeyLabel: (label) => set({ keyLabel: label }),
  keySetupOpen: false,
  setKeySetupOpen: (open) => set({ keySetupOpen: open }),
  selectedModel: 'openai/gpt-4.1-mini',
  setSelectedModel: (model) => set({ selectedModel: model }),
  availableModels: [],
  setAvailableModels: (models) => set({ availableModels: models }),

  sidebarView: 'files',
  setSidebarView: (view) => set({ sidebarView: view }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  files: [],
  setFiles: (files) => set({ files }),
  openFiles: [],
  activeFileIndex: -1,
  openFile: (path, name, content) => {
    const state = get()
    const existingIndex = state.openFiles.findIndex(f => f.path === path)
    if (existingIndex >= 0) {
      set({ activeFileIndex: existingIndex })
      return
    }
    const newFile: OpenFile = { path, name, content, language: getLanguageFromPath(path), modified: false }
    set({ openFiles: [...state.openFiles, newFile], activeFileIndex: state.openFiles.length })
  },
  closeFile: (index) => {
    const state = get()
    const newFiles = state.openFiles.filter((_, i) => i !== index)
    let newActive = state.activeFileIndex
    if (index <= state.activeFileIndex) {
      newActive = Math.max(0, state.activeFileIndex - 1)
    }
    if (newFiles.length === 0) newActive = -1
    set({ openFiles: newFiles, activeFileIndex: newActive })
  },
  setActiveFile: (index) => set({ activeFileIndex: index }),
  updateFileContent: (index, content) => set((s) => ({
    openFiles: s.openFiles.map((f, i) => i === index ? { ...f, content, modified: true } : f)
  })),

  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({
    chatMessages: [...s.chatMessages, {
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || Date.now(),
      isStreaming: msg.isStreaming,
      toolCalls: msg.toolCalls,
    } as ChatMessage]
  })),
  appendToLastMessage: (content) => set((s) => {
    const msgs = [...s.chatMessages]
    if (msgs.length > 0) {
      const last = { ...msgs[msgs.length - 1] }
      last.content += content
      msgs[msgs.length - 1] = last
    }
    return { chatMessages: msgs }
  }),
  clearChat: () => set({ chatMessages: [] }),
  chatLoading: false,
  setChatLoading: (loading) => set({ chatLoading: loading }),

  terminalHistory: ['Welcome to Orion Terminal\n$ '],
  addTerminalOutput: (output) => set((s) => ({ terminalHistory: [...s.terminalHistory, output] })),
  clearTerminal: () => set({ terminalHistory: ['$ '] }),
  terminalVisible: true,
  toggleTerminal: () => set((s) => ({ terminalVisible: !s.terminalVisible })),

  agentStatus: 'idle',
  setAgentStatus: (status) => set({ agentStatus: status }),
  agentError: null,
  setAgentError: (message) => set({ agentError: message }),
  agentPlan: '',
  setAgentPlan: (plan) => set({ agentPlan: plan }),
  agentTasks: [],
  setAgentTasks: (tasks) => {
    if (typeof tasks === 'function') {
      set((s) => ({ agentTasks: tasks(s.agentTasks) }))
    } else {
      set({ agentTasks: tasks })
    }
  },
  pendingReview: null,
  setPendingReview: (review) => set({ pendingReview: review, reviewHidden: false }),
  reviewHidden: false,
  setReviewHidden: (hidden) => set({ reviewHidden: hidden }),
  threadId: loadThreadId(),
  setThreadId: (id) => {
    try { sessionStorage.setItem(THREAD_STORAGE, id) } catch { /* ignore */ }
    set({ threadId: id })
  },

  checkpoints: [],
  setCheckpoints: (checkpoints) => set({ checkpoints }),

  loadedSkills: [],
  addLoadedSkill: (name) => set((s) => ({ loadedSkills: s.loadedSkills.includes(name) ? s.loadedSkills : [...s.loadedSkills, name] })),
  clearLoadedSkills: () => set({ loadedSkills: [] }),
  testOutput: null,
  setTestOutput: (output) => set({ testOutput: output }),

  chatPanelOpen: true,
  toggleChatPanel: () => set((s) => ({ chatPanelOpen: !s.chatPanelOpen })),
}))

export default useStore
