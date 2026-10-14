import { notFound } from "next/navigation";
import { chapters, getChapter } from "@/lib/registry";
import { ChapterLayout } from "@/components/IDE/ChapterLayout";
import { ReaderLayout } from "@/components/Chapter/ReaderLayout";
import { SITE_MODE } from "@/lib/siteMode";

export function generateStaticParams() {
  return chapters.map((ch) => ({ slug: ch.slug }));
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  if (SITE_MODE === "reader") {
    return <ReaderLayout chapter={chapter} />;
  }
  return <ChapterLayout chapter={chapter} />;
}
