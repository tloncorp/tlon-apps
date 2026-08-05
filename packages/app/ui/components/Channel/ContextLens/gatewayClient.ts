import type { ContextLens, ContextLensEvent } from './types';

export type ContextLensGatewayConfig = {
  baseUrl: string;
  token: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function authHeaders(config: ContextLensGatewayConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.token}` };
}

export async function fetchRecentContextLensEvents(
  config: ContextLensGatewayConfig,
  signal?: AbortSignal
): Promise<ContextLensEvent[]> {
  const response = await fetch(
    `${normalizeBaseUrl(config.baseUrl)}/tlon/context-lens/recent`,
    { headers: authHeaders(config), signal }
  );
  if (!response.ok) {
    throw new Error(`context lens recent fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    events?: ContextLensEvent[];
  } | null;
  return Array.isArray(payload?.events) ? payload.events : [];
}

export async function fetchContextLensRun(
  config: ContextLensGatewayConfig,
  lensId: string,
  signal?: AbortSignal
): Promise<ContextLens | null> {
  const response = await fetch(
    `${normalizeBaseUrl(config.baseUrl)}/tlon/context-lens/run?lensId=${encodeURIComponent(lensId.trim())}`,
    { headers: authHeaders(config), signal }
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`context lens run fetch failed: ${response.status}`);
  }
  const payload = (await response.json()) as { lens?: ContextLens } | null;
  return payload?.lens ?? null;
}

type SseFrame = {
  id: string | null;
  event: string | null;
  data: string;
};

function parseSseFrame(raw: string): SseFrame {
  const frame: SseFrame = { id: null, event: null, data: '' };
  const dataLines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'id') {
      frame.id = value;
    } else if (field === 'event') {
      frame.event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }
  frame.data = dataLines.join('\n');
  return frame;
}

/**
 * Fetch-streaming SSE client. `EventSource` can't send an Authorization
 * header, and putting the token in a query param would leak it into logs;
 * this same approach also works on React Native via expo/fetch later.
 *
 * Runs a single connection attempt — reconnection (with `lastEventId` for
 * replay) is the caller's job.
 */
export function streamContextLensEvents(
  config: ContextLensGatewayConfig,
  opts: {
    lastEventId?: number | null;
    onEvent: (event: ContextLensEvent, eventId: number | null) => void;
    onOpen?: () => void;
    onClose?: (error?: unknown) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    const headers: Record<string, string> = {
      ...authHeaders(config),
      Accept: 'text/event-stream',
    };
    if (typeof opts.lastEventId === 'number') {
      headers['Last-Event-ID'] = String(opts.lastEventId);
    }
    const response = await fetch(
      `${normalizeBaseUrl(config.baseUrl)}/tlon/context-lens/events`,
      { headers, signal: controller.signal }
    );
    if (!response.ok || !response.body) {
      throw new Error(`context lens stream failed: ${response.status}`);
    }
    opts.onOpen?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const boundary = buffer.search(/\r?\n\r?\n/);
        if (boundary === -1) {
          break;
        }
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
        const frame = parseSseFrame(raw);
        if (frame.event !== 'context-lens' || !frame.data) {
          continue;
        }
        const eventId =
          frame.id && Number.isFinite(Number(frame.id))
            ? Number(frame.id)
            : null;
        try {
          opts.onEvent(JSON.parse(frame.data) as ContextLensEvent, eventId);
        } catch {
          // Ignore malformed frames from mismatched gateway versions.
        }
      }
    }
    opts.onClose?.();
  })().catch((error) => {
    if (!controller.signal.aborted) {
      opts.onClose?.(error);
    }
  });

  return () => controller.abort();
}
