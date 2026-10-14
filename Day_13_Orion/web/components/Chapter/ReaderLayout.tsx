import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getAdjacentChapters } from "@/lib/registry";
import type { ChapterDef } from "@/lib/schema";

type ReaderLayoutProps = {
  chapter: ChapterDef;
};

export function ReaderLayout({ chapter }: ReaderLayoutProps) {
  const { prev, next } = getAdjacentChapters(chapter.slug);
  const code = chapter.backendCode?.replace(/\/\* lesson:(begin|end) \*\/\n?/g, "").trim();

  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <p className="font-code text-primary-light text-label-caps uppercase tracking-widest">
        {chapter.lesson} / {String(chapter.number).padStart(2, "0")}
        {chapter.subtopicLabel ? ` / ${chapter.subtopicLabel}` : ""}
      </p>
      <h1 className="font-headline text-headline-lg text-ink mt-3">{chapter.title}</h1>
      <p className="font-body text-body-lg text-gray2 mt-3">{chapter.subtitle}</p>

      {(chapter.cursorFeature || chapter.designPatterns?.length) && (
        <div className="flex flex-wrap gap-2 mt-5">
          {chapter.cursorFeature && (
            <span className="font-code text-xs px-2.5 py-1 rounded bg-surface border border-hairline text-gray2">
              Cursor: {chapter.cursorFeature}
            </span>
          )}
          {chapter.designPatterns?.map((pattern) => (
            <span
              key={pattern}
              className="font-code text-xs px-2.5 py-1 rounded bg-surface border border-hairline text-gray2"
            >
              {pattern}
            </span>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-headline text-headline-sm text-ink">What this chapter adds</h2>
        <p className="font-body text-body-md text-gray2 mt-3 leading-relaxed">{chapter.intro}</p>
      </section>

      {code && (
        <section className="mt-10">
          <h2 className="font-headline text-headline-sm text-ink">The code</h2>
          {chapter.backendFilename && (
            <p className="font-code text-xs text-gray3 mt-2">{chapter.backendFilename}</p>
          )}
          <div className="mt-3 rounded-md border border-hairline bg-code-bg overflow-x-auto">
            <pre className="font-code text-code-md text-ink p-5 whitespace-pre">
              <code>{code}</code>
            </pre>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-headline text-headline-sm text-ink">Takeaway</h2>
        <p className="font-body text-body-md text-gray2 mt-3 leading-relaxed">{chapter.takeaway}</p>
      </section>

      <nav className="flex items-center justify-between gap-4 mt-14 pt-6 border-t border-hairline">
        {prev ? (
          <Link
            href={`/curriculum/${prev.slug}`}
            className="inline-flex items-center gap-2 font-code text-sm text-gray2 hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
            {String(prev.number).padStart(2, "0")} {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/curriculum/${next.slug}`}
            className="inline-flex items-center gap-2 font-code text-sm text-primary-light hover:text-ink text-right"
          >
            {String(next.number).padStart(2, "0")} {next.title}
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link href="/curriculum" className="font-code text-sm text-primary-light hover:text-ink">
            Back to the curriculum
          </Link>
        )}
      </nav>
    </article>
  );
}
