import type { LogLine, FixturePair } from "./schema";

export type RunResult = {
  output: string;
  log: LogLine[];
};

export type RunCallbacks = {
  onLog?: (line: LogLine) => void;
  onOutputChunk?: (chunk: string) => void;
  onDone?: (result: RunResult) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunkOutput(output: string): string[] {
  if (output.length < 900) {
    return output.split("\n").map((line) => `${line}\n`);
  }
  return output
    .split(/\n{2,}/)
    .map((block) => `${block.trimEnd()}\n\n`);
}

export async function runFixture(
  fixture: FixturePair,
  cb: RunCallbacks = {},
): Promise<RunResult> {
  for (const line of fixture.log) {
    await sleep(180);
    cb.onLog?.(line);
  }

  await sleep(140);

  const chunks = chunkOutput(fixture.output);
  for (const chunk of chunks) {
    await sleep(fixture.output.length < 900 ? 35 : 90);
    cb.onOutputChunk?.(chunk);
  }

  const result: RunResult = { output: fixture.output, log: fixture.log };
  cb.onDone?.(result);
  return result;
}

export async function runFixturesPairwise(
  left: FixturePair,
  right: FixturePair,
  leftCb: RunCallbacks,
  rightCb: RunCallbacks,
): Promise<[RunResult, RunResult]> {
  return Promise.all([
    runFixture(left, leftCb),
    runFixture(right, rightCb),
  ]);
}
