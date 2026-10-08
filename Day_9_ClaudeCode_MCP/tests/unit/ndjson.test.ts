import { describe, it, expect } from "vitest";
import { readNdjson } from "../../src/lib/ndjson";

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const p of parts) c.enqueue(p);
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("parses objects split across chunks, including split multi-byte characters", async () => {
    const bytes = new TextEncoder().encode('{"a":"café"}\n{"b":2}\n{"c":3}');
    const cut = bytes.indexOf(0xc3) + 1; // split inside "é"
    const items: unknown[] = [];
    await readNdjson(streamOf([bytes.slice(0, 4), bytes.slice(4, cut), bytes.slice(cut)]), (i) => items.push(i));
    expect(items).toEqual([{ a: "café" }, { b: 2 }, { c: 3 }]);
  });

  it("ignores blank lines", async () => {
    const items: unknown[] = [];
    await readNdjson(streamOf([new TextEncoder().encode('\n{"a":1}\n\n')]), (i) => items.push(i));
    expect(items).toEqual([{ a: 1 }]);
  });
});
