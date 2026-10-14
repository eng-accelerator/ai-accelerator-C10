"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Terminal, BookOpen, Rocket } from "lucide-react";
import { SITE_MODE } from "@/lib/siteMode";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Terminal },
  { href: "/curriculum", label: "Curriculum", icon: BookOpen },
  { href: "/playground", label: "Playground", icon: Bot },
  { href: "/curriculum/codebase-rag", label: "Full Agent", icon: Rocket },
].filter((item) => SITE_MODE !== "reader" || item.href !== "/playground");

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-night border-b border-hairline">
      <div className="h-full max-w-screen-2xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-headline text-headline-sm text-ink tracking-tight">
            ORION<span className="text-primary-light">_</span>TUTORIAL
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded font-code text-sm transition-colors ${
                  isActive
                    ? "text-primary-light bg-surface"
                    : "text-gray2 hover:text-ink hover:bg-surface-hover"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
