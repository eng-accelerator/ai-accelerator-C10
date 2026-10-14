import type { LogLine, LogTag } from "@/lib/schema";

const tagClasses: Record<LogTag, string> = {
  BOOT: "text-code-func",
  INFO: "text-ink-variant",
  OK: "text-green-400",
  STREAM: "text-code-func",
  WARN: "text-yellow-300",
  ERROR: "text-red-400",
  SUCCESS: "text-green-400",
  PROCESS: "text-code-keyword",
  TOOL: "text-primary",
  RETRY: "text-yellow-300",
};

export function TerminalLogPanel({ logs }: { logs: LogLine[] }) {
  return (
    <section className="h-56 shrink-0 border-t border-outline-variant bg-terminal flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-surface">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber" />
          <span className="w-2.5 h-2.5 rounded-full bg-volt" />
          <span className="ml-3 font-code text-[10px] tracking-widest uppercase text-primary">
            Terminal Logs
          </span>
        </div>
        <span className="font-code text-[10px] tracking-widest uppercase text-gray3">
          subprocess
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-code text-[11px] leading-5">
        {logs.length === 0 ? (
          <p className="text-ink-variant/50">Click EXECUTE to watch the agent run.</p>
        ) : (
          logs.map((log, index) => (
            <div key={`${log.text}-${index}`} className="flex gap-2">
              {log.tag ? (
                <span className={`w-16 shrink-0 ${tagClasses[log.tag]}`}>
                  [{log.tag}]
                </span>
              ) : null}
              <span className="text-ink whitespace-pre-wrap">{log.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
