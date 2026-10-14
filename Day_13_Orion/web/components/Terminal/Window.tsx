import type { ReactNode } from "react";

export function TerminalWindow({
  title,
  rightLabel,
  children,
  className = "",
  bodyClassName = "",
  accent = "#8B5CF6",
}: {
  title: string;
  rightLabel?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: string;
}) {
  return (
    <div className={`bg-terminal rounded border border-hairline overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-surface">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber" />
          <span className="w-2.5 h-2.5 rounded-full bg-volt" />
          <span
            className="ml-3 font-code text-[11px] tracking-widest uppercase"
            style={{ color: accent }}
          >
            {title}
          </span>
        </div>
        {rightLabel ? (
          <span className="font-code text-[10px] tracking-widest uppercase text-gray3">
            {rightLabel}
          </span>
        ) : null}
      </div>
      <div className={`p-4 font-code text-sm text-ink ${bodyClassName}`}>{children}</div>
    </div>
  );
}
