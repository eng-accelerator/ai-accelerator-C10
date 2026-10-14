import Link from "next/link";
import { chapters } from "@/lib/registry";

export function ChapterTimeline() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-headline text-headline-md text-ink text-center mb-12">
          The Learning Path
        </h2>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-hairline lg:left-1/2" />

          <div className="space-y-8">
            {chapters.map((ch, i) => (
              <Link
                key={ch.slug}
                href={`/curriculum/${ch.slug}`}
                className={`relative flex items-start gap-6 group ${
                  i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                <div className="absolute left-6 lg:left-1/2 w-3 h-3 -ml-1.5 mt-2 rounded-full bg-primary border-2 border-night z-10" />

                <div
                  className={`ml-14 lg:ml-0 lg:w-1/2 ${
                    i % 2 === 0 ? "lg:pr-12 lg:text-right" : "lg:pl-12"
                  }`}
                >
                  <div className="bg-surface border border-hairline rounded-lg p-5 hover:border-primary/40 transition-colors">
                    <span className="font-code text-xs text-primary-light">
                      {ch.lesson} / {String(ch.number).padStart(2, "0")}
                    </span>
                    <h3 className="font-headline text-headline-sm text-ink mt-1">
                      {ch.title}
                    </h3>
                    <p className="font-body text-sm text-gray2 mt-2">
                      {ch.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
