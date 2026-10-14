"use client";

import { GitBranch, CheckCircle } from "lucide-react";

export function StatusFooter() {
  return (
    <div className="h-6 bg-surface-high text-ink-variant flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 font-headline text-[9px] font-bold tracking-wide uppercase">
          <GitBranch className="w-3 h-3" />
          <span>main*</span>
        </div>
        <div className="flex items-center gap-1 font-headline text-[9px] font-bold tracking-wide uppercase">
          <CheckCircle className="w-3 h-3" />
          <span>sync ok</span>
        </div>
      </div>
      <div className="flex items-center gap-4 font-headline text-[9px] font-bold tracking-wide uppercase">
        <span>Python 3.11</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
}
