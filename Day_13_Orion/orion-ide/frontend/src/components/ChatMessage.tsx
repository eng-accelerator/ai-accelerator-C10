import { useState } from 'react';
import { Bot, User, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ChatMessage } from '../types';

function timeAgo(ts?: number): string {
  if (!ts) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md overflow-hidden my-2 border border-orion-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-orion-bg-tertiary text-xs text-orion-text-secondary">
        <span>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-orion-text-primary transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function ToolCallItem({ toolCall }: { toolCall: { name: string; args?: Record<string, unknown> | string; result?: string } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 border border-orion-border rounded bg-orion-bg-input">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-orion-text-secondary hover:text-orion-text-primary transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-mono font-medium text-orion-accent-teal">{toolCall.name}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {toolCall.args && (
            <pre className="text-xs text-orion-text-secondary font-mono whitespace-pre-wrap break-all">
              {typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args, null, 2)}
            </pre>
          )}
          {toolCall.result && (
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all mt-1">
              {toolCall.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  message: ChatMessage;
}

export default function ChatMessageComponent({ message }: Props) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <div className="flex gap-2">
        <div className="w-6 h-6 rounded bg-orion-bg-input flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot size={14} className="text-orion-accent-teal" />
        </div>
        <div className="flex-1 bg-orion-bg-input rounded-lg p-3 text-xs font-mono text-orion-text-secondary">
          <pre className="whitespace-pre-wrap break-all">{message.content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isUser ? 'bg-orion-accent-blue/30' : 'bg-orion-bg-input'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-orion-accent-blue" />
        ) : (
          <Bot size={14} className="text-orion-accent-teal" />
        )}
      </div>

      <div
        className={`flex-1 max-w-[85%] rounded-lg p-3 ${
          isUser ? 'bg-orion-accent-blue/20' : 'bg-orion-bg-tertiary'
        }`}
      >
        {isUser ? (
          <p className="text-sm text-orion-text-primary whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-orion-text-primary">
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match) {
                    return <CodeBlock language={match[1]}>{codeString}</CodeBlock>;
                  }

                  return (
                    <code
                      className="bg-orion-bg-input px-1.5 py-0.5 rounded text-xs text-orion-accent-teal"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            />
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 bg-orion-accent-blue animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {message.toolCalls?.map((tc, i) => <ToolCallItem key={i} toolCall={tc} />)}

        {message.timestamp && (
          <p className="text-[10px] text-orion-text-muted mt-2">{timeAgo(message.timestamp)}</p>
        )}
      </div>
    </div>
  );
}
