import { randomUUID } from 'node:crypto';
import type {
  OpenClawPluginApi,
  OpenClawConfig,
} from 'openclaw/plugin-sdk/core';
import type { PluginStateKeyedStore } from './plugin-state-types.js';
import {
  resolveBrowserHandoffAccount,
  runBrowserHandoffCommand,
} from './tlon-command-runner.js';
import { readMcpReply } from './browser-session-handoff.js';
import { urbitFetch } from './urbit/fetch.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { sharedSlot } from './shared-state.js';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
type Pending = {
  requestId: string;
  sessionKey: string;
  sessionId: string;
  expiresAt: number;
  result?: string;
  sent?: boolean;
};
const terminal = new Set([
  'connected',
  'ready',
  'filled',
  'failed',
  'cancelled',
  'expired',
  'unknown',
]);

export async function readWalletResult(
  config: OpenClawConfig,
  requestId: string,
  signal?: AbortSignal
) {
  const account = resolveBrowserHandoffAccount(config);
  const server = object(object(object(object(config).mcp).servers).mcp);
  const url = new URL(String(server.url));
  if (
    server.transport !== 'streamable-http' ||
    server.enabled === false ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/apps/mcp/mcp' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Wallet MCP proxy is unavailable.');
  const headers = object(server.headers);
  if (
    !Object.values(headers).every((value) => typeof value === 'string') ||
    !Object.keys(headers).some((key) => key.toLowerCase() === 'x-api-key')
  )
    throw new Error('Wallet MCP proxy is not authenticated.');
  const id = randomUUID();
  const reply = await urbitFetch({
    baseUrl: url.origin,
    path: url.pathname,
    init: {
      method: 'POST',
      signal,
      headers: {
        ...(headers as Record<string, string>),
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: {
          name: 'browser_payment_status',
          arguments: { request_id: requestId },
        },
      }),
    },
    ssrfPolicy: ssrfPolicyFromAllowPrivateNetwork(account.allowPrivateNetwork),
    timeoutMs: 10000,
    maxRedirects: 0,
    auditContext: 'tlon-wallet-status',
  });
  try {
    const payload = object(await readMcpReply(reply.response, id));
    const result = object(payload.result);
    const content = object(result.structuredContent);
    if (
      payload.id !== id ||
      payload.error ||
      result.isError ||
      content.request_id !== requestId
    )
      throw new Error('Wallet status unavailable.');
    return content;
  } finally {
    await reply.release();
  }
}

export function createWalletHandoffs(deps: {
  store: PluginStateKeyedStore<Pending>;
  read: (id: string, signal?: AbortSignal) => Promise<Record<string, unknown>>;
  send: (id: string) => Promise<unknown>;
  sessionIdFor: (key: string) => string | undefined;
  resume: (request: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
    deliver: true;
  }) => Promise<unknown>;
  warn: () => void;
}) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let polling: Promise<void> | undefined;
  const deliveries = new Map<string, Promise<void>>();
  const send = (row: Pending) => {
    if (deliveries.has(row.requestId)) return deliveries.get(row.requestId)!;
    const task = (async () => {
      await deps.send(row.requestId);
      await deps.store.register(row.requestId, { ...row, sent: true });
    })().finally(() => deliveries.delete(row.requestId));
    deliveries.set(row.requestId, task);
    return task;
  };
  async function poll() {
    if (polling || !controller || controller.signal.aborted) return polling;
    const signal = controller.signal;
    polling = (async () => {
      for (const { key, value: row } of await deps.store.entries()) {
        if (signal.aborted) return;
        if (deps.sessionIdFor(row.sessionKey) !== row.sessionId) {
          await deps.store.delete(key);
          continue;
        }
        try {
          let status = row.result;
          if (!status) {
            if (row.expiresAt <= Date.now()) status = 'expired';
            else {
              const result = await deps.read(row.requestId, signal);
              if (!terminal.has(String(result.status))) {
                if (!row.sent) await send(row);
                continue;
              }
              status = String(result.status);
            }
            await deps.store.register(key, { ...row, result: status });
          }
          if (
            signal.aborted ||
            deps.sessionIdFor(row.sessionKey) !== row.sessionId
          )
            continue;
          await deps.resume({
            sessionKey: row.sessionKey,
            idempotencyKey: `tlon-wallet:${row.requestId}`,
            deliver: true,
            message: `Wallet request ${row.requestId}: ${status}. Read payment_status for details. Approval or filling does not mean a purchase succeeded. If cancelled, expired, failed or unknown, do not repeat payment authorization or fill; report the outcome and wait for the owner.`,
          });
          await deps.store.delete(key);
        } catch {
          if (!signal.aborted) deps.warn();
        }
      }
    })().finally(() => {
      polling = undefined;
    });
    return polling;
  }
  return {
    async handle(
      event: {
        toolName: string;
        params: Record<string, unknown>;
        result?: unknown;
        error?: string;
      },
      ctx: { sessionKey?: string; sessionId?: string }
    ) {
      if (
        event.error ||
        event.toolName !== 'mcp__call' ||
        ![
          'browser_wallet_connect',
          'browser_payment_request',
          'wallet_connect',
          'payment_request',
        ].includes(String(event.params.name))
      )
        return;
      const result = object(event.result);
      const details = object(result.details);
      const output = object(details.structuredContent);
      const requestId = output.request_id;
      if (
        result.isError ||
        details.status === 'error' ||
        output.owner_action_required !== true ||
        typeof requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(requestId)
      )
        return;
      const sessionKey = ctx.sessionKey;
      const sessionId = sessionKey && deps.sessionIdFor(sessionKey);
      if (
        !sessionKey ||
        !sessionId ||
        (ctx.sessionId && ctx.sessionId !== sessionId)
      )
        throw new Error(
          'Wallet handoff requires an active owner conversation.'
        );
      const existing = await deps.store.lookup(requestId);
      if (existing?.sent) return;
      const expiresAt = Number(output.expires_at);
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now())
        throw new Error('Wallet request expired.');
      const row = existing || { requestId, sessionKey, sessionId, expiresAt };
      await deps.store.registerIfAbsent(requestId, row);
      await send(row);
    },
    poll,
    start() {
      if (timer) return;
      controller = new AbortController();
      timer = setInterval(() => {
        void poll().catch(deps.warn);
      }, 4000);
      timer.unref();
      void poll().catch(deps.warn);
    },
    async stop() {
      controller?.abort();
      clearInterval(timer);
      timer = undefined;
      await polling;
    },
  };
}

const slot =
  sharedSlot<ReturnType<typeof createWalletHandoffs>>('walletHandoffs');
export function registerWalletHandoffs(api: OpenClawPluginApi, binary: string) {
  let service = slot.get();
  if (!service) {
    service = createWalletHandoffs({
      store: api.runtime.state.openKeyedStore<Pending>({
        namespace: 'wallet-handoffs',
        maxEntries: 64,
      }),
      read: (id, signal) => readWalletResult(api.config, id, signal),
      send: (id) =>
        runBrowserHandoffCommand(binary, ['browser', 'wallet', id], api.config),
      sessionIdFor: (sessionKey) =>
        api.runtime.agent.session.getSessionEntry({ sessionKey })?.sessionId,
      resume: (request) => api.runtime.subagent.run(request),
      warn: () => api.logger.warn('[tlon] Wallet handoff delivery will retry.'),
    });
    slot.set(service);
  }
  const current = service;
  api.registerService({
    id: 'tlon-wallet-handoffs',
    start: () => current.start(),
    stop: () => current.stop(),
  });
  return current;
}
