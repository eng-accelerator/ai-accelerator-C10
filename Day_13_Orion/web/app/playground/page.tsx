import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_MODE } from "@/lib/siteMode";
import { ChapterLayout } from "@/components/IDE/ChapterLayout";
import { playground } from "@/lib/playground";

export const metadata: Metadata = {
  title: "Orion Playground // Production Coding Agent",
  description:
    "Experience Orion's production coding agent with graph tracing, chat, generated files, terminal logs, and code review in one editor.",
};

export default function PlaygroundPage() {
  if (SITE_MODE === "reader") notFound();
  return <ChapterLayout chapter={playground} defaultView="files" />;
}
