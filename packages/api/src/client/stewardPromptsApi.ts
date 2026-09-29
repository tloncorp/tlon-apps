import { z } from 'zod';

import type {
  StewardPromptFiles,
  StewardPromptResponse,
  StewardPromptUpdate,
} from '../urbit/stewardPrompts';
import { requestJson, scry, subscribe } from './urbit';

const PATH = '/steward/~/v1/prompts';
// Steward answers an expired session with 401, where requestJson only
// reauthenticates on 403 by default. 403 is left out on purpose: the edit
// route uses it for an untrusted bot, which no reauthentication can fix.
const OPTIONS = { reauthStatuses: [401] };
const responseSchema = z.object({
  requestId: z.string(),
  body: z.discriminatedUnion('type', [
    z.object({ type: z.literal('updated'), name: z.string() }),
    z.object({
      type: z.literal('error'),
      errorType: z.enum([
        'not-authorized',
        'not-found',
        'invalid',
        'harness-offline',
        'harness-error',
        'unknown',
      ]),
      message: z.array(z.string()),
    }),
    z.object({
      type: z.literal('pending'),
      status: z.enum(['sending', 'acked', 'nacked']),
    }),
  ]),
});

export class StewardPromptEditError extends Error {
  constructor(
    readonly requestId: string,
    readonly body: Extract<StewardPromptResponse['body'], { type: 'error' }>
  ) {
    super(`Prompt edit failed (${body.errorType}): ${body.message.join('\n')}`);
    this.name = 'StewardPromptEditError';
  }
}

export class StewardPromptPendingError extends Error {
  constructor(
    readonly requestId: string,
    readonly status: 'sending' | 'acked' | 'nacked'
  ) {
    super('Prompt edit is still pending');
    this.name = 'StewardPromptPendingError';
  }
}

function settle(response: StewardPromptResponse) {
  const { requestId, body } = response;
  switch (body.type) {
    case 'updated':
      return { requestId, name: body.name };
    case 'error':
      throw new StewardPromptEditError(requestId, body);
    case 'pending':
      throw new StewardPromptPendingError(requestId, body.status);
  }
}

/** A successful response confirms the workspace write; the feed supplies contents. */
export async function setStewardPrompt(params: {
  bot: string;
  name: string;
  text: string;
  requestId?: string;
}) {
  const { bot, name, text, requestId } = params;
  const raw = await requestJson(
    PATH,
    'POST',
    {
      ...(requestId ? { requestId } : {}),
      bot,
      action: { set: { name, text } },
    },
    OPTIONS
  );
  return settle(responseSchema.parse(raw));
}

/** Pending is returned as data so the caller can continue waiting for a late result. */
export async function getStewardPromptRequest(
  requestId: string,
  options: { signal?: AbortSignal } = {}
): Promise<StewardPromptResponse> {
  return responseSchema.parse(
    await requestJson(
      `${PATH}/request/${encodeURIComponent(requestId)}`,
      'GET',
      undefined,
      options.signal ? { ...OPTIONS, signal: options.signal } : OPTIONS
    )
  );
}

/**
 * Poll until the request is terminal. The signal stops both the requests
 * and the waits between them: a caller torn down mid-poll (navigation,
 * logout, an account switch) must not keep polling — possibly a different
 * ship — for the rest of the minute.
 */
export async function awaitStewardPromptRequest(
  requestId: string,
  {
    attempts = 30,
    intervalMs = 2_000,
    signal,
  }: { attempts?: number; intervalMs?: number; signal?: AbortSignal } = {}
) {
  let status: 'sending' | 'acked' | 'nacked' = 'sending';
  for (let attempt = 0; attempt < attempts; attempt++) {
    signal?.throwIfAborted();
    const response = await getStewardPromptRequest(
      requestId,
      signal ? { signal } : {}
    );
    if (response.body.type !== 'pending') return settle(response);
    status = response.body.status;
    if (attempt + 1 < attempts) {
      await sleep(intervalMs, signal);
    }
  }
  throw new StewardPromptPendingError(requestId, status);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function getStewardPromptFiles(): Promise<StewardPromptFiles> {
  return requestJson(`${PATH}/files`, 'GET', undefined, OPTIONS);
}

export function scryStewardPromptFiles(): Promise<StewardPromptFiles> {
  return scry({ app: 'steward', path: '/v1/prompts/files' });
}

export function subscribeToStewardPrompts(
  handler: (update: StewardPromptUpdate) => void
) {
  return subscribe({ app: 'steward', path: '/v1/prompts/files' }, handler);
}
