import { createHash } from 'node:crypto';
import { isTrustedBrowserViewerHost } from '@tloncorp/api';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type { PluginStateKeyedStore } from 'openclaw/plugin-sdk/plugin-state-runtime';
import { z } from 'zod';

import { sharedSlot } from './shared-state.js';

const resultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  z.object({
    status: z.literal('filled'),
    submitted: z.boolean(),
    saveStatus: z.enum(['saved', 'pending', 'failed']).optional(),
  }),
  z.object({ status: z.literal('failed') }),
  z.object({ status: z.literal('cancelled') }),
]);
type BrowserResult = z.infer<typeof resultSchema>;
type CompletedResult = Exclude<BrowserResult, { status: 'pending' }>;

export function browserToolSessionId(
  toolName: string,
  params: Record<string, unknown>
): string | undefined {
  if (
    toolName !== 'mcp__call' ||
    typeof params.name !== 'string' ||
    !params.name.startsWith('browser_')
  )
    return;
  let args = params.arguments;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return;
    }
  }
  if (
    args &&
    typeof args === 'object' &&
    'session_id' in args &&
    typeof args.session_id === 'string'
  )
    return args.session_id;
}

export type BrowserHandoffRequest = {
  browserSessionId: string;
  viewerUrl: string;
};
type PendingHandoff = BrowserHandoffRequest & {
  id: string;
  sessionKey: string;
  sessionId: string;
  expiresAt: number;
  result?: CompletedResult;
};

function resultEndpoint(viewerUrl: string) {
  const url = new URL(viewerUrl);
  const match = /^\/s\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (
    url.protocol !== 'https:' ||
    !isTrustedBrowserViewerHost(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !match
  )
    throw new Error('Invalid secure-entry result endpoint.');
  return new URL(`/credential-result/${match[1]}`, url.origin);
}

export async function readBrowserHandoffResult(
  viewerUrl: string,
  signal: AbortSignal
): Promise<BrowserResult> {
  const response = await fetch(resultEndpoint(viewerUrl), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    redirect: 'error',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (response.status === 401 || response.status === 404)
    return { status: 'failed' };
  if (!response.ok) throw new Error('Secure-entry result is unavailable.');
  return resultSchema.parse(await response.json());
}

function resultMessage(handoff: PendingHandoff, result: CompletedResult) {
  const prefix = `Secure-entry result for browser session ${handoff.browserSessionId} (request ${handoff.id}): `;
  if (result.status === 'cancelled')
    return (
      prefix +
      'cancelled. The owner closed secure entry. Do not retry it unless asked.'
    );
  if (result.status === 'failed')
    return (
      prefix +
      'failed or unavailable. Filling is not confirmed. Inspect the current page before deciding how to recover; do not claim sign-in succeeded or repeat the fill.'
    );
  return (
    prefix +
    `filled; submission ${result.submitted ? 'attempted' : 'not attempted'}. ` +
    (result.saveStatus ? `Saving the login: ${result.saveStatus}. ` : '') +
    'Resume the task in this browser session. Inspect the current page: filling does not confirm sign-in or authorize a purchase. Handle ordinary page controls, including optional passkey setup, yourself. If more private fields are needed, request a fresh secure-entry card. Never request credentials in chat.'
  );
}

export function createBrowserHandoffResults({
  store,
  readResult,
  resume,
  sessionIdFor,
  warn,
}: {
  store: PluginStateKeyedStore<PendingHandoff>;
  readResult: typeof readBrowserHandoffResult;
  resume: (request: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
    deliver: true;
  }) => Promise<unknown>;
  sessionIdFor: (sessionKey: string) => string | undefined;
  warn: () => void;
}) {
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling: Promise<void> | undefined;

  async function deliver(
    key: string,
    handoff: PendingHandoff,
    signal: AbortSignal
  ) {
    if (sessionIdFor(handoff.sessionKey) !== handoff.sessionId) {
      await store.delete(key);
      return;
    }
    let result = handoff.result;
    if (!result) {
      if (handoff.expiresAt <= Date.now()) result = { status: 'failed' };
      else {
        let observed: BrowserResult;
        try {
          observed = await readResult(handoff.viewerUrl, signal);
        } catch {
          return;
        }
        if (observed.status === 'pending') return;
        result = observed;
      }
      if (signal.aborted || (await store.lookup(key))?.id !== handoff.id)
        return;
      await store.register(key, { ...handoff, result });
    }
    if (signal.aborted || (await store.lookup(key))?.id !== handoff.id) return;
    if (sessionIdFor(handoff.sessionKey) !== handoff.sessionId) {
      await store.delete(key);
      return;
    }
    await resume({
      sessionKey: handoff.sessionKey,
      message: resultMessage(handoff, result),
      idempotencyKey: `tlon-browser-handoff:${handoff.id}`,
      deliver: true,
    });
    await store.delete(key);
  }

  function poll() {
    if (!controller || controller.signal.aborted) return Promise.resolve();
    if (polling) return polling;
    const signal = controller.signal;
    polling = store
      .entries()
      .then((entries) =>
        Promise.all(
          entries.map(async ({ key, value }) => {
            try {
              await deliver(key, value, signal);
            } catch {
              if (!signal.aborted) warn();
            }
          })
        )
      )
      .then(() => undefined)
      .finally(() => {
        polling = undefined;
      });
    return polling;
  }

  return {
    async watch(
      request: BrowserHandoffRequest,
      ctx: { sessionKey?: string; sessionId?: string }
    ) {
      const sessionKey = ctx.sessionKey;
      const sessionId = sessionKey && sessionIdFor(sessionKey);
      if (
        !sessionKey ||
        !sessionId ||
        (ctx.sessionId && ctx.sessionId !== sessionId)
      )
        throw new Error('Secure entry requires an active agent conversation.');
      const endpoint = resultEndpoint(request.viewerUrl);
      const token = endpoint.pathname.split('/').at(-1)!;
      const payload = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf8')
      );
      const expiresAt = payload.exp * 1000;
      if (
        !Number.isSafeInteger(expiresAt) ||
        expiresAt <= Date.now() ||
        !payload.form
      )
        throw new Error('Secure entry requires a live, form-bound request.');
      const initial = await readResult(
        request.viewerUrl,
        new AbortController().signal
      ).catch(() => {
        throw new Error('Secure-entry result delivery is unavailable.');
      });
      if (initial.status !== 'pending')
        throw new Error('Secure-entry result delivery is unavailable.');
      const id = createHash('sha256').update(token).digest('hex');
      const handoff = { ...request, id, sessionKey, sessionId, expiresAt };
      if (!(await store.registerIfAbsent(request.browserSessionId, handoff)))
        throw new Error(
          'This browser is waiting for secure entry. Wait for its result.'
        );
    },
    async isPending(browserSessionId: string) {
      const handoff = await store.lookup(browserSessionId);
      return !!handoff && !handoff.result;
    },
    start() {
      if (controller && !controller.signal.aborted) return;
      controller = new AbortController();
      timer = setInterval(() => {
        void poll().catch(warn);
      }, 2_000);
      timer.unref();
      void poll().catch(warn);
    },
    async stop() {
      controller?.abort();
      clearInterval(timer);
      await polling;
    },
    poll,
  };
}

const serviceSlot = sharedSlot<ReturnType<typeof createBrowserHandoffResults>>(
  'browserHandoffResults'
);

export function registerBrowserHandoffResults(api: OpenClawPluginApi) {
  let service = serviceSlot.get();
  if (!service) {
    service = createBrowserHandoffResults({
      store: api.runtime.state.openKeyedStore<PendingHandoff>({
        namespace: 'browser-handoffs',
        maxEntries: 64,
      }),
      readResult: readBrowserHandoffResult,
      resume: (request) => api.runtime.subagent.run(request),
      sessionIdFor: (sessionKey) =>
        api.runtime.agent.session.getSessionEntry({ sessionKey })?.sessionId,
      warn: () =>
        api.logger.warn('[tlon] Secure-entry result delivery will retry.'),
    });
    serviceSlot.set(service);
  }
  const current = service;
  api.registerService({
    id: 'tlon-browser-handoffs',
    start: () => current.start(),
    stop: () => current.stop(),
  });
  return current;
}
