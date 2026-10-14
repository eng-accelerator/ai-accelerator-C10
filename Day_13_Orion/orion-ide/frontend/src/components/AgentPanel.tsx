import { useState } from 'react';
import {
  Play, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, Eye, RotateCcw, KeyRound,
} from 'lucide-react';
import useStore from '../store/useStore';
import { fetchFiles, fetchPending, resetWorkspace, runAgent } from '../api/client';

/**
 * Agent mode: one feature request in, a plan, generated files, tests, an AI
 * review, then a pause at the human gate. The events handled below are the
 * ones routers/agent.py emits; `approval_needed` opens ReviewDialog and
 * `paused` marks the run as waiting so the panel offers "Open review".
 */

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  idle: { color: 'text-orion-text-muted', icon: <Clock size={14} />, label: 'Idle' },
  planning: { color: 'text-orion-accent-amber', icon: <Loader2 size={14} className="animate-spin" />, label: 'Planning...' },
  coding: { color: 'text-orion-accent-blue', icon: <Loader2 size={14} className="animate-spin" />, label: 'Coding...' },
  reviewing: { color: 'text-orion-accent-purple', icon: <Loader2 size={14} className="animate-spin" />, label: 'Reviewing...' },
  waiting_approval: { color: 'text-orion-accent-amber', icon: <AlertCircle size={14} className="animate-pulse" />, label: 'Waiting for Approval' },
  applying: { color: 'text-orion-accent-teal', icon: <Loader2 size={14} className="animate-spin" />, label: 'Applying Changes...' },
  testing: { color: 'text-orion-accent-blue', icon: <Loader2 size={14} className="animate-spin" />, label: 'Testing...' },
  verifying: { color: 'text-orion-accent-blue', icon: <Loader2 size={14} className="animate-spin" />, label: 'Verifying...' },
  done: { color: 'text-green-400', icon: <CheckCircle2 size={14} />, label: 'Done' },
  error: { color: 'text-orion-accent-red', icon: <XCircle size={14} />, label: 'Error' },
};

const taskStatusIcon: Record<string, React.ReactNode> = {
  pending: <span className="w-3 h-3 rounded-full border border-orion-text-muted inline-block" />,
  in_progress: <Loader2 size={12} className="text-orion-accent-blue animate-spin" />,
  done: <CheckCircle2 size={12} className="text-green-400" />,
  error: <XCircle size={12} className="text-orion-accent-red" />,
};

export default function AgentPanel() {
  const {
    apiKey, serverHasKey, setKeySetupOpen, selectedModel,
    agentStatus, setAgentStatus, agentError, setAgentError, agentPlan, setAgentPlan,
    agentTasks, setAgentTasks, pendingReview, setPendingReview, setReviewHidden,
    threadId, setThreadId,
    loadedSkills, addLoadedSkill, clearLoadedSkills, testOutput, setTestOutput,
  } = useStore();

  const [featureRequest, setFeatureRequest] = useState('');
  const [resetting, setResetting] = useState(false);
  const hasKey = Boolean(apiKey) || serverHasKey;
  const isWaiting = agentStatus === 'waiting_approval';
  const isRunning = !['idle', 'done', 'error', 'waiting_approval'].includes(agentStatus);

  const handleOpenReview = async () => {
    if (pendingReview) {
      setReviewHidden(false);
      return;
    }
    const data = await fetchPending(threadId);
    if (data.waiting && data.review) {
      setPendingReview({
        threadId,
        plan: data.review.plan || '',
        reviewResult: data.review.review_result || '',
        testOutput: data.review.test_output || '',
        changes: data.review.changes || [],
      });
    } else {
      setAgentError('This run is no longer waiting. Start a new one.');
      setAgentStatus('idle');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset workspace/ to the original sample project? Everything the agent wrote there is discarded.')) return;
    setResetting(true);
    try {
      await resetWorkspace();
      const data = await fetchFiles();
      useStore.getState().setFiles(Array.isArray(data) ? data : data.files || []);
      setAgentStatus('idle');
      setAgentPlan(null);
      setAgentTasks([]);
      setTestOutput(null);
      setAgentError(null);
    } finally {
      setResetting(false);
    }
  };

  const handleRun = () => {
    if (!featureRequest.trim()) return;
    if (!hasKey) {
      setKeySetupOpen(true);
      return;
    }
    if (isWaiting && !window.confirm('A run is still waiting for your review. Start a new one and drop it?')) return;

    const newThreadId = `thread_${Date.now()}`;
    setThreadId(newThreadId);
    setAgentStatus('planning');
    setAgentError(null);
    setAgentPlan(null);
    setAgentTasks([]);
    setPendingReview(null);
    clearLoadedSkills();
    setTestOutput(null);

    runAgent(featureRequest, selectedModel, newThreadId, (event: Record<string, any>) => {
      switch (event.type) {
        case 'status':
          setAgentStatus(event.status);
          break;
        case 'plan':
          setAgentPlan(event.plan);
          if (event.tasks) {
            setAgentTasks(event.tasks.map((t: any) => ({
              filepath: t.filepath,
              description: t.description,
              action: t.action,
              status: 'pending',
            })));
          }
          break;
        case 'code':
          setAgentTasks((prev: typeof agentTasks) => {
            const exists = prev.some((t) => t.filepath === event.filepath);
            if (exists) {
              return prev.map((t) => t.filepath === event.filepath ? { ...t, status: event.status || 'done' } : t);
            }
            return [...prev, { filepath: event.filepath, description: event.description || '', action: 'create' as const, status: 'done' as const }];
          });
          break;
        case 'skill_loaded':
          addLoadedSkill(event.name);
          break;
        case 'test':
          setTestOutput(`${event.status === 'tests_passed' || event.status === 'done' ? 'PASS' : 'FAIL'}\n${event.output || ''}`);
          break;
        case 'approval_needed':
          setPendingReview({
            threadId: newThreadId,
            plan: event.plan || '',
            reviewResult: event.review_result || '',
            testOutput: event.test_output || '',
            changes: event.changes || [],
          });
          setAgentStatus('waiting_approval');
          break;
        case 'paused':
          setAgentStatus('waiting_approval');
          break;
        case 'error':
          setAgentError(event.message || 'Something went wrong.');
          setAgentStatus('error');
          break;
      }
    });
  };

  const status = statusConfig[agentStatus] || statusConfig.idle;

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-orion-text-secondary uppercase">
          Agent Mode
        </span>
        <button
          onClick={handleReset}
          disabled={resetting || isRunning}
          title="Restore workspace/ from sample_project/ (same as `uv run orion reset`)"
          className="flex items-center gap-1 text-[11px] text-orion-text-secondary hover:text-orion-text-primary disabled:opacity-40"
        >
          <RotateCcw size={12} className={resetting ? 'animate-spin' : ''} /> Reset workspace
        </button>
      </div>

      {!hasKey && (
        <button
          onClick={() => setKeySetupOpen(true)}
          className="w-full flex items-center gap-2 text-left text-xs bg-orion-accent-soft border border-orion-border rounded-md px-3 py-2 text-orion-text-primary hover:border-orion-accent-purple"
        >
          <KeyRound size={14} className="text-orion-accent-purple shrink-0" />
          Add your OpenRouter key to run the agent
        </button>
      )}

      {/* Feature Request */}
      <div className="space-y-2">
        <textarea
          value={featureRequest}
          onChange={(e) => setFeatureRequest(e.target.value)}
          placeholder="Describe the feature to implement..."
          rows={4}
          className="w-full bg-orion-bg-input border border-orion-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-orion-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-orion-accent-blue"
        />
        <button
          onClick={handleRun}
          disabled={isRunning || !featureRequest.trim()}
          className="w-full h-10 flex items-center justify-center gap-2 bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {isRunning ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-2 text-sm ${status.color}`}>
        {status.icon}
        <span>{status.label}</span>
      </div>

      {isWaiting && (
        <button
          onClick={handleOpenReview}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-md text-sm font-medium border border-orion-accent-amber/60 text-orion-accent-amber hover:bg-orion-bg-tertiary"
        >
          <Eye size={14} /> Open review
        </button>
      )}

      {agentError && (
        <div className="bg-orion-bg-tertiary border border-orion-accent-red/50 rounded-md p-3 text-xs text-orion-text-primary whitespace-pre-wrap">
          {agentError}
        </div>
      )}

      {loadedSkills.length > 0 && (
        <div className="bg-orion-accent-soft border border-orion-border rounded-md p-3">
          <h4 className="text-xs font-semibold text-orion-accent-purple-hover uppercase tracking-wider mb-1">Skills loaded</h4>
          <ul className="text-xs font-mono text-orion-text-primary space-y-0.5">
            {loadedSkills.map((name) => <li key={name}>read_skill("{name}")</li>)}
          </ul>
        </div>
      )}

      {/* Plan */}
      {agentPlan && (
        <div className="bg-orion-bg-tertiary border border-orion-border rounded-lg p-3 space-y-2">
          <h4 className="text-xs font-semibold text-orion-accent-amber uppercase tracking-wider">
            Plan
          </h4>
          <p className="text-sm text-orion-text-primary whitespace-pre-wrap">
            {agentPlan}
          </p>
        </div>
      )}

      {/* Tasks */}
      {agentTasks.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-orion-text-secondary uppercase tracking-wider mb-2">
            Tasks
          </h4>
          {agentTasks.map((task, i) => (
            <div
              key={i}
              className="flex items-start gap-2 py-1.5 px-2 rounded bg-orion-bg-tertiary border border-orion-border"
            >
              <span className="mt-0.5 flex-shrink-0">
                {taskStatusIcon[task.status] || taskStatusIcon.pending}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-orion-accent-teal truncate">{task.filepath}</p>
                <p className="text-xs text-orion-text-secondary">{task.description}</p>
              </div>
              {task.action && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-secondary flex-shrink-0">
                  {task.action}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {testOutput && (
        <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-3">
          <h4 className="text-xs font-semibold text-orion-text-secondary uppercase tracking-wider mb-1">Tests</h4>
          <pre className="text-[11px] font-mono text-orion-text-primary whitespace-pre-wrap max-h-40 overflow-auto">{testOutput}</pre>
        </div>
      )}
    </div>
  );
}
