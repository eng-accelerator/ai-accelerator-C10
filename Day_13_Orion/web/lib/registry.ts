import type { ChapterDef } from "./schema";

import { ch01 } from "./chapters/ch01";
import { ch02 } from "./chapters/ch02";
import { ch03 } from "./chapters/ch03";
import { ch04 } from "./chapters/ch04";
import { ch05 } from "./chapters/ch05";
import { ch06 } from "./chapters/ch06";
import { ch07 } from "./chapters/ch07";
import { ch08 } from "./chapters/ch08";
import { ch09 } from "./chapters/ch09";
import { ch10 } from "./chapters/ch10";
import { ch11 } from "./chapters/ch11";
import { ch12 } from "./chapters/ch12";
import { ch13 } from "./chapters/ch13";
import { ch14 } from "./chapters/ch14";
import { ch15 } from "./chapters/ch15";
import { ch16 } from "./chapters/ch16";
import { ch17 } from "./chapters/ch17";
import { ch18 } from "./chapters/ch18";

export const chapters: ChapterDef[] = [
  ch01, ch02, ch03, ch04, ch05, ch06, ch07,
  ch08, ch09, ch10, ch11, ch12,
  ch13, ch14, ch15, ch16, ch17, ch18,
];

export function getChapter(slug: string): ChapterDef | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function getAdjacentChapters(slug: string) {
  const idx = chapters.findIndex((c) => c.slug === slug);
  return {
    prev: idx > 0 ? chapters[idx - 1] : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1] : null,
  };
}
