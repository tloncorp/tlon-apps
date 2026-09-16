import { z } from 'zod';

import type {
  StewardPromptFiles,
  StewardPromptResponse,
  StewardPromptUpdate,
} from '../urbit/stewardPrompts';
import { requestJson, scry, subscribe } from './urbit';

const PATH = '/steward/~/v1/prompts';
const OPTIONS = { reauthStatuses: [401, 403] };
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
  requestId: string
): Promise<StewardPromptResponse> {
  return responseSchema.parse(
    await requestJson(
      `${PATH}/request/${encodeURIComponent(requestId)}`,
      'GET',
      undefined,
      OPTIONS
    )
  );
}

export async function awaitStewardPromptRequest(
  requestId: string,
  { attempts = 30, intervalMs = 2_000 } = {}
) {
  let status: 'sending' | 'acked' | 'nacked' = 'sending';
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await getStewardPromptRequest(requestId);
    if (response.body.type !== 'pending') return settle(response);
    status = response.body.status;
    if (attempt + 1 < attempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new StewardPromptPendingError(requestId, status);
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
