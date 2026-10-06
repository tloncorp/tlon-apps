const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function readMcpReply(
  response: Response,
  id: string
): Promise<unknown> {
  const mediaType = response.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  const eventStream = mediaType === 'text/event-stream';
  if (!response.ok || (mediaType !== 'application/json' && !eventStream)) {
    throw new Error('Invalid browser lookup response.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing browser lookup response.');
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 65_536)
        throw new Error('Browser lookup response is too large.');
      text += decoder.decode(next.value, { stream: true });
      if (eventStream) {
        // Only complete events are parsed; JSON and UTF-8 characters can span
        // chunks. Progress notifications do not complete this request.
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/.exec(text))) {
          const event = text.slice(0, boundary.index);
          text = text.slice(boundary.index + boundary[0].length);
          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n');
          if (!data) continue;
          const message: unknown = JSON.parse(data);
          if (record(message).id === id) return message;
        }
      }
    }
    if (eventStream) throw new Error('Browser lookup ended without a result.');
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
