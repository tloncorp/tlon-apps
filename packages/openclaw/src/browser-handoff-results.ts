import {
  resumeBrowserContinuation,
  type ResumeBrowserHandoff,
} from './browser-continuation.js';
import {
  handoffTooOld,
  handoffFailureReason,
  nextHandoffRetry,
  type HandoffRetry,
} from './browser-handoff-retry.js';
import { createHash } from 'node:crypto';
import {
  isTrustedBrowserViewerHost,
  isBrowserViewerDevelopmentOrigin,
} from '@tloncorp/api';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import { z } from 'zod';

import type { PluginStateKeyedStore } from './plugin-state-types.js';
import { sharedSlot } from './shared-state.js';
import { urbitFetch } from './urbit/fetch.js';

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
  deliveryRetry?: HandoffRetry;
  workerRunId?: string;
};

function handoffEndpoint(
  viewerUrl: string,
  path: 'credential-result' | 'credentials' = 'credential-result'
) {
  const url = new URL(viewerUrl);
  const match = /^\/s\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (
    (!isBrowserViewerDevelopmentOrigin(
      url,
      process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN
    ) &&
      (url.protocol !== 'https:' ||
        !!url.port ||
        !isTrustedBrowserViewerHost(url.hostname))) ||
    url.username ||
    url.password ||
    url.hash ||
    !match
  )
    throw new Error('Invalid secure-entry result endpoint.');
  return new URL(`/${path}/${match[1]}`, url.origin);
}

export async function cancelBrowserHandoff(viewerUrl: string): Promise<void> {
  const url = handoffEndpoint(viewerUrl, 'credentials');
  const { response, release } = await urbitFetch({
    baseUrl: url.origin,
    path: url.pathname,
    init: { method: 'DELETE', redirect: 'error', credentials: 'omit' },
    ssrfPolicy: {
      allowPrivateNetwork: isBrowserViewerDevelopmentOrigin(
        url,
        process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN
      ),
    },
    pinDns: true,
    maxRedirects: 0,
    timeoutMs: 5_000,
  });
  try {
    await response.body?.cancel();
    if (!response.ok) throw new Error('Secure entry could not be cancelled.');
  } finally {
    await release();
  }
}

export async function readBrowserHandoffResult(
  viewerUrl: string,
  signal: AbortSignal
): Promise<BrowserResult> {
  const url = handoffEndpoint(viewerUrl);
  // Only the explicitly configured development viewer may sit on a private
  // address; every other result origin keeps the deny-private-network policy.
  const development = isBrowserViewerDevelopmentOrigin(
    url,
    process.env.TLON_BROWSER_VIEWER_DEV_ORIGIN
  );
  const { response, release } = await urbitFetch({
    baseUrl: url.origin,
    path: url.pathname,
    init: {
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    },
    ssrfPolicy: { allowPrivateNetwork: development },
    pinDns: true,
    maxRedirects: 0,
    timeoutMs: 5_000,
    signal,
  });
  try {
    if (response.status === 401 || response.status === 404)
      return { status: 'failed' };
    if (!response.ok) throw new Error('Secure-entry result is unavailable.');
    return resultSchema.parse(await response.json());
  } finally {
    await release();
  }
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
    'Resume the task in this browser session. Inspect the current page: filling does not confirm sign-in or authorize a purchase. Choose the next ordinary page action yourself. Dismiss optional passkey enrollment with an observed Skip or Not now control unless the owner requested enrollment. If more private fields are needed, request a fresh secure-entry card. Never request credentials in chat.'
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
  resume: ResumeBrowserHandoff;
  sessionIdFor: (sessionKey: string) => string | undefined;
  warn: (message: string) => void;
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
    if (handoffTooOld(handoff.expiresAt)) {
      await store.delete(key);
      warn(
        `[tlon] Retired secure-entry handoff ${handoff.id} after its delivery window.`
      );
      return;
    }
    if (
      handoff.deliveryRetry &&
      handoff.deliveryRetry.nextAttemptAt > Date.now()
    )
      return;
    let result = handoff.result;
    if (!result) {
      if (handoff.expiresAt <= Date.now()) result = { status: 'failed' };
      else {
        const observed = await readResult(handoff.viewerUrl, signal);
        if (observed.status === 'pending') return;
        result = observed;
      }
    }
    if (signal.aborted || (await store.lookup(key))?.id !== handoff.id) return;
    // Only the active form uses the browser key. A completed form can retry
    // independently while the same browser handles a new secure-entry card.
    if (key === handoff.browserSessionId) {
      const receiptKey = `result:${handoff.id}`;
      const inserted = await store.registerIfAbsent(receiptKey, {
        ...handoff,
        result,
      });
      await store.delete(key);
      if (!inserted) return;
      key = receiptKey;
    }
    if (sessionIdFor(handoff.sessionKey) !== handoff.sessionId) {
      await store.delete(key);
      return;
    }
    try {
      const workerRunId = await resume(
        {
          sessionKey: handoff.sessionKey,
          message: resultMessage(handoff, result),
          idempotencyKey: `tlon-browser-handoff:${handoff.id}`,
        },
        handoff.workerRunId
      );
      if (workerRunId) {
        if (workerRunId !== handoff.workerRunId)
          await store.register(key, {
            ...handoff,
            result,
            workerRunId,
            deliveryRetry: undefined,
          });
        return;
      }
    } catch (error) {
      await store.register(key, {
        ...handoff,
        result,
        deliveryRetry: nextHandoffRetry(handoff.deliveryRetry),
      });
      if (!handoff.deliveryRetry)
        warn(
          `[tlon] Secure-entry ${handoff.id} agent resume failed (${handoffFailureReason(error)}); retrying.`
        );
      return;
    }
    await store.delete(key);
  }

  function poll() {
    if (!controller || controller.signal.aborted) return Promise.resolve();
    if (polling) return polling;
    const signal = controller.signal;
    polling = store
      .entries()
      .then(async (entries) => {
        // A restart can split the copy and delete that release the browser.
        // The result record owns delivery from that point, even if it finishes
        // in this same poll.
        const keys = new Set(entries.map(({ key }) => key));
        await Promise.all(
          entries.map(async ({ key, value }) => {
            if (
              key === value.browserSessionId &&
              keys.has(`result:${value.id}`)
            ) {
              if ((await store.lookup(key))?.id === value.id)
                await store.delete(key);
              return;
            }
            try {
              await deliver(key, value, signal);
            } catch (error) {
              if (
                !signal.aborted &&
                (await store.lookup(key))?.id === value.id
              ) {
                await store.register(key, {
                  ...value,
                  deliveryRetry: nextHandoffRetry(value.deliveryRetry),
                });
                if (!value.deliveryRetry)
                  warn(
                    `[tlon] Secure-entry ${value.id} status poll failed (${handoffFailureReason(error)}); retrying.`
                  );
              }
            }
          })
        );
      })
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
      const endpoint = handoffEndpoint(request.viewerUrl);
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
      return async () => {
        if ((await store.lookup(request.browserSessionId))?.id === id)
          await store.delete(request.browserSessionId);
      };
    },
    async isPending(browserSessionId: string) {
      return !!(await store.lookup(browserSessionId));
    },
    start() {
      if (controller && !controller.signal.aborted) return;
      controller = new AbortController();
      timer = setInterval(() => {
        void poll().catch(() =>
          warn('[tlon] Secure-entry handoff store poll failed.')
        );
      }, 2_000);
      timer.unref();
      void poll().catch(() =>
        warn('[tlon] Secure-entry handoff store poll failed.')
      );
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
      resume: (request, runId) =>
        resumeBrowserContinuation(api.runtime, request, runId),
      sessionIdFor: (sessionKey) =>
        api.runtime.agent.session.getSessionEntry({ sessionKey })?.sessionId,
      warn: (message) => api.logger.warn(message),
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
