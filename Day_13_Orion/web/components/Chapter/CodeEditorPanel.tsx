"use client";

import type { CodeFile } from "@/lib/schema";
import { FileCode2 } from "lucide-react";

export function CodeEditorPanel({
  codeFile,
  accent = "#8B5CF6",
}: {
  codeFile: CodeFile;
  accent?: string;
}) {
  const lines = codeFile.content.split("\n");

  return (
    <div className="rounded-lg border border-hairline overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-hairline bg-surface"
        style={{ borderTopColor: accent, borderTopWidth: "2px" }}
      >
        <FileCode2 className="w-3.5 h-3.5" style={{ color: accent }} />
        <span className="font-code text-[11px] text-ink">
          {codeFile.filename}
        </span>
        <span className="ml-auto px-2 py-0.5 rounded bg-surface-low font-code text-[9px] uppercase tracking-widest text-gray3">
          {codeFile.language}
        </span>
      </div>
      <div className="bg-terminal p-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="leading-relaxed">
                <td className="pr-4 text-right select-none font-code text-[11px] text-gray3/50 w-8">
                  {i + 1}
                </td>
                <td className="font-code text-[12px] text-ink whitespace-pre">
                  {line || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
