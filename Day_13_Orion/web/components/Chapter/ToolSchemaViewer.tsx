"use client";

import { Code2, Braces } from "lucide-react";

export function ToolSchemaViewer({
  functionCode,
  schema,
  toolName,
}: {
  functionCode: string;
  schema: string;
  toolName: string;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-px bg-hairline rounded-lg overflow-hidden border border-hairline">
      <div className="bg-terminal">
        <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-hairline">
          <Code2 className="w-3.5 h-3.5 text-volt" />
          <span className="font-code text-[10px] tracking-widest uppercase text-volt font-bold">
            Python Function
          </span>
          <span className="ml-auto font-code text-[10px] text-gray3">
            @tool
          </span>
        </div>
        <pre className="p-4 font-code text-[11px] leading-relaxed text-ink overflow-x-auto whitespace-pre">
          {functionCode}
        </pre>
      </div>

      <div className="bg-terminal">
        <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-hairline">
          <Braces className="w-3.5 h-3.5 text-primary-light" />
          <span className="font-code text-[10px] tracking-widest uppercase text-primary-light font-bold">
            Auto-Generated Schema
          </span>
          <span className="ml-auto font-code text-[10px] text-gray3">
            {toolName}
          </span>
        </div>
        <pre className="p-4 font-code text-[11px] leading-relaxed text-ink overflow-x-auto whitespace-pre">
          {schema}
        </pre>
      </div>
    </div>
  );
}
