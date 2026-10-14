import type { LogLine as LogLineType, LogTag } from "@/lib/schema";

const TAG_COLOR: Record<LogTag, string> = {
  BOOT: "#A1A1AA",
  INFO: "#A78BFA",
  OK: "#4ADE80",
  STREAM: "#A1A1AA",
  WARN: "#FACC15",
  ERROR: "#FB7185",
  SUCCESS: "#4ADE80",
  PROCESS: "#60A5FA",
  TOOL: "#FB923C",
  RETRY: "#EA580C",
};

export function LogLine({ line, index }: { line: LogLineType; index: number }) {
  const ts = line.ts ?? `0:${(index * 0.4).toFixed(2).padStart(5, "0")}`;
  const color = line.tag ? TAG_COLOR[line.tag] : "#F4F4F5";
  return (
    <div className="font-code text-xs leading-relaxed flex gap-3 animate-log-in">
      <span className="text-gray3 shrink-0">[{ts}]</span>
      {line.tag ? (
        <span className="shrink-0 font-bold" style={{ color }}>
          [{line.tag}]
        </span>
      ) : null}
      <span className="text-gray2 break-words">{line.text}</span>
    </div>
  );
}
