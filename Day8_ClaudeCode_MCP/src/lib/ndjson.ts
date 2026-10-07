export async function readNdjson<T>(body: ReadableStream<Uint8Array>, onItem: (item: T) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flushLines = () => {
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onItem(JSON.parse(line) as T);
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushLines();
  }
  buffer += decoder.decode();
  flushLines();
  const rest = buffer.trim();
  if (rest) onItem(JSON.parse(rest) as T);
}
