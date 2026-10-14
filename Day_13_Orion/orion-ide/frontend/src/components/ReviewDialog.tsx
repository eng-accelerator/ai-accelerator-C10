import { useState } from 'react';
import { X, FileDiff, FileCode2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import useStore from '../store/useStore';
import { approveAgent, fetchFiles } from '../api/client';
import type { ReviewChange } from '../types';

/**
 * The human gate. The graph is paused inside `human_review_node`; nothing is on
 * disk yet. Approve resumes it through apply and verify. Reject sends your reason
 * back to the coder and the loop runs again until it pauses here once more.
 * Closing with X only hides the dialog: the run stays paused and "Open review"
 * in the Agent panel brings it back.
 */
export default function ReviewDialog() {
  const {
    pendingReview, setPendingReview, reviewHidden, setReviewHidden,
    threadId, setAgentStatus, setAgentError,
  } = useStore();

  const [feedback, setFeedback] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [view, setView] = useState<'diff' | 'full'>('diff');

  if (!pendingReview || reviewHidden) return null;

  const refreshFiles = () =>
    fetchFiles().then((data) => {
      const files = Array.isArray(data) ? data : data.files || [];
      useStore.getState().setFiles(files);
    });

  const handleDecision = (decision: 'approve' | 'reject') => {
    const reason = feedback.trim();
    setPendingReview(null);
    setAgentError(null);
    setAgentStatus(decision === 'approve' ? 'applying' : 'coding');
    setRejecting(false);
    setFeedback('');

    approveAgent(threadId, decision, decision === 'reject' ? reason : '', (event: Record<string, any>) => {
      switch (event.type) {
        case 'status':
          setAgentStatus(event.status);
          if (event.status === 'done') refreshFiles();
          break;
        case 'done':
          setAgentStatus('done');
          refreshFiles();
          break;
        case 'paused':
          setAgentStatus('waiting_approval');
          break;
        case 'approval_needed':
          setPendingReview({
            threadId,
            plan: event.plan || '',
            reviewResult: event.review_result || '',
            testOutput: event.test_output || '',
            changes: event.changes || [],
          });
          setAgentStatus('waiting_approval');
          break;
        case 'test':
          useStore.getState().setTestOutput(`${event.status === 'tests_passed' || event.status === 'done' ? 'PASS' : 'FAIL'}\n${event.output || ''}`);
          break;
        case 'error':
          setAgentError(event.message || 'Something went wrong.');
          setAgentStatus('error');
          break;
      }
    });
  };

  const langFromPath = (filepath: string): string => {
    const ext = filepath.split('.').pop() || '';
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', json: 'json', css: 'css', html: 'html', md: 'markdown',
    };
    return map[ext] || 'text';
  };

  const body = (change: ReviewChange) => {
    if (view === 'diff' && change.diff) return { code: change.diff, language: 'diff' };
    return { code: change.code || change.preview || '', language: langFromPath(change.filepath) };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-orion-bg-secondary rounded-lg border border-orion-border max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-orion-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Review before anything touches disk</h2>
            <p className="text-xs text-orion-text-secondary mt-0.5">The agent is paused. Approve to apply and re-run the tests, or send it back with a reason.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-orion-border overflow-hidden text-xs">
              <button
                onClick={() => setView('diff')}
                className={`px-2.5 py-1.5 flex items-center gap-1 ${view === 'diff' ? 'bg-orion-accent-soft text-orion-text-primary' : 'text-orion-text-secondary hover:bg-orion-bg-tertiary'}`}
              >
                <FileDiff size={13} /> Diff
              </button>
              <button
                onClick={() => setView('full')}
                className={`px-2.5 py-1.5 flex items-center gap-1 ${view === 'full' ? 'bg-orion-accent-soft text-orion-text-primary' : 'text-orion-text-secondary hover:bg-orion-bg-tertiary'}`}
              >
                <FileCode2 size={13} /> Full file
              </button>
            </div>
            <button
              onClick={() => setReviewHidden(true)}
              title="Hide (the run stays paused; reopen from the Agent panel)"
              className="p-1 rounded hover:bg-orion-bg-input text-orion-text-secondary hover:text-orion-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {pendingReview.plan && (
            <div className="bg-orion-accent-soft border border-orion-border rounded-lg p-4">
              <h3 className="text-xs font-semibold text-orion-accent-purple-hover uppercase tracking-wider mb-2">Plan</h3>
              <p className="text-sm text-orion-text-primary whitespace-pre-wrap">{pendingReview.plan}</p>
            </div>
          )}

          {pendingReview.reviewResult && (
            <div className="bg-orion-bg-tertiary border border-orion-border rounded-lg p-4">
              <h3 className="text-xs font-semibold text-orion-accent-purple-hover uppercase tracking-wider mb-2">AI review</h3>
              <p className="text-sm text-orion-text-primary whitespace-pre-wrap">{pendingReview.reviewResult}</p>
            </div>
          )}

          {pendingReview.testOutput && (
            <div className="bg-orion-bg-tertiary border border-orion-border rounded-md p-4">
              <h3 className="text-xs font-semibold text-orion-text-secondary uppercase tracking-wider mb-2">Tests (run on a copy of the workspace)</h3>
              <pre className="text-[11px] font-mono text-orion-text-primary whitespace-pre-wrap max-h-40 overflow-auto">{pendingReview.testOutput}</pre>
            </div>
          )}

          {pendingReview.changes?.map((change: ReviewChange, i: number) => {
            const { code, language } = body(change);
            return (
              <div key={i} className="border border-orion-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-orion-bg-tertiary flex items-center justify-between gap-3">
                  <span className="text-sm font-mono text-orion-accent-teal flex items-center gap-2">
                    {change.filepath}
                    {change.action && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orion-bg-input text-orion-text-secondary font-sans">{change.action}</span>
                    )}
                  </span>
                  <span className="text-xs text-orion-text-secondary truncate">{change.explanation}</span>
                </div>
                {code ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    customStyle={{ margin: 0, borderRadius: 0, fontSize: '12px', maxHeight: '360px' }}
                  >
                    {code}
                  </SyntaxHighlighter>
                ) : (
                  <p className="px-4 py-3 text-xs text-orion-text-muted">No changes against the file on disk.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-orion-border flex-shrink-0 space-y-3">
          {rejecting && (
            <label className="block text-[11px] text-orion-text-secondary">
              Why? The coder gets this verbatim, and it overrides the AI reviewer.
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. Call the constant TAGLINE and keep it under 40 characters."
                className="mt-1 w-full bg-orion-bg-input border border-orion-border rounded-md px-3 py-2 text-sm text-orion-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
              />
            </label>
          )}
          <div className="flex items-center justify-end gap-3">
            {rejecting ? (
              <>
                <button onClick={() => setRejecting(false)} className="h-10 px-3 rounded-md text-sm text-orion-text-secondary hover:text-orion-text-primary">Cancel</button>
                <button
                  onClick={() => handleDecision('reject')}
                  disabled={!feedback.trim()}
                  className="h-10 px-4 rounded-md text-sm font-semibold text-orion-accent-red border border-orion-border hover:bg-orion-bg-tertiary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
                >
                  Send back with this reason
                </button>
              </>
            ) : (
              <button
                onClick={() => setRejecting(true)}
                className="h-10 px-4 rounded-md text-sm font-semibold text-orion-accent-red hover:bg-orion-bg-tertiary focus:outline-none focus:ring-2 focus:ring-orion-accent-purple"
              >
                Reject
              </button>
            )}
            <button
              onClick={() => handleDecision('approve')}
              className="h-10 px-4 rounded-md text-sm font-semibold bg-orion-accent-purple text-orion-text-primary hover:bg-orion-accent-purple-hover focus:outline-none focus:ring-2 focus:ring-orion-accent-purple focus:ring-offset-2 focus:ring-offset-orion-bg-secondary"
            >
              Approve and apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
