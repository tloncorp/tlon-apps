import {
  resumeBrowserContinuation,
  type ResumeBrowserHandoff,
} from './browser-continuation.js';
import {
  handoffTooOld,
  handoffFailureReason,
  nextHandoffRetry,
  workerReportDeadline,
  type HandoffRetry,
} from './browser-handoff-retry.js';
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
  deliveryRetry?: HandoffRetry;
  workerRunId?: string;
  workerReportDeadline?: number;
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
  resume: ResumeBrowserHandoff;
  warn: (message: string) => void;
}) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let polling: Promise<void> | undefined;
  const deliveries = new Map<string, Promise<void>>();
  const send = (row: Pending) => {
    if (deliveries.has(row.requestId)) return deliveries.get(row.requestId)!;
    const task = (async () => {
      const current = await deps.store.lookup(row.requestId);
      if (!current || current.sent) return;
      await deps.send(row.requestId);
      await deps.store.register(row.requestId, { ...current, sent: true });
    })().finally(() => deliveries.delete(row.requestId));
    deliveries.set(row.requestId, task);
    return task;
  };
  async function poll() {
    if (polling || !controller || controller.signal.aborted) return polling;
    const signal = controller.signal;
    polling = (async () => {
      for (const { key, value } of await deps.store.entries()) {
        let row = value;
        if (signal.aborted) return;
        if (deps.sessionIdFor(row.sessionKey) !== row.sessionId) {
          await deps.store.delete(key);
          continue;
        }
        if (handoffTooOld(row)) {
          await deps.store.delete(key);
          deps.warn(
            `[tlon] Retired wallet handoff ${key} after its delivery window.`
          );
          continue;
        }
        if (row.deliveryRetry && Date.now() < row.deliveryRetry.nextAttemptAt)
          continue;
        let stage: NonNullable<HandoffRetry['stage']> = 'status read';
        try {
          let status = row.result;
          if (!status || (status === 'ready' && !row.workerRunId)) {
            const expired = row.expiresAt <= Date.now();
            const result = await deps.read(row.requestId, signal);
            if (signal.aborted) return;
            // The card sender also updates this row. Let it finish before persisting the result.
            if (deliveries.has(key)) continue;
            const observed = String(result.status);
            status = terminal.has(observed)
              ? observed
              : expired
                ? 'expired'
                : undefined;
            if (status === 'ready' && row.expiresAt <= Date.now())
              status = 'expired';
            const deliveryRetry =
              row.deliveryRetry?.stage === 'status read'
                ? undefined
                : row.deliveryRetry;
            if (status !== row.result || deliveryRetry !== row.deliveryRetry) {
              const current = await deps.store.lookup(key);
              if (!current || deliveries.has(key)) continue;
              row = { ...current, result: status, deliveryRetry };
              await deps.store.register(key, row);
            }
            if (!status) {
              stage = 'card delivery';
              if (!row.sent && row.expiresAt > Date.now()) await send(row);
              continue;
            }
          }
          stage = 'agent resume';
          if (
            signal.aborted ||
            deps.sessionIdFor(row.sessionKey) !== row.sessionId
          )
            continue;
          const workerRunId = await deps.resume(
            {
              sessionKey: row.sessionKey,
              idempotencyKey: `tlon-wallet:${row.requestId}`,
              message: `Wallet request ${row.requestId}: ${status}. Read payment_status for details. ${
                status === 'connected'
                  ? 'Link is now connected. Continue the original task, inspect the current checkout and request separate payment approval for the verified purchase. Connecting Link is not authorization to spend.'
                  : status === 'ready'
                    ? 'The owner approved the reviewed purchase. Read payment_source from payment_status. For site_saved, skip payment-field inspection and filling: use the selected method already saved on the site. For link, fill the approved checkout. Inspect and verify the merchant, items, total, selected payment method and destination still match, then submit once and verify the result from the page. No second approval is needed for the unchanged order. Respect any original fill-only or no-purchase boundary. If the order changed, obtain fresh approval. If submission is ambiguous, inspect the page or order history without resubmitting. Report completion only after seeing an order confirmation; otherwise report what remains unresolved.'
                    : status === 'unknown'
                      ? 'The payment outcome is uncertain. Use ordinary browser tools to inspect the existing checkout or order history; the fill may already have written card fields. Continue only if the page establishes the next step and it remains within the owner’s original purchase approval and task boundaries. Do not repeat payment authorization or fill automatically. If submission may already have happened, verify the outcome without resubmitting. Report unresolved uncertainty and ask the owner when needed.'
                      : 'Approval or filling does not mean a purchase succeeded. If cancelled, expired or failed, do not repeat payment authorization or fill; report the outcome and wait for the owner.'
              }`,
            },
            row.workerRunId
          );
          if (!workerRunId) await deps.store.delete(key);
          else if (workerRunId !== row.workerRunId || row.deliveryRetry) {
            await deps.store.register(key, {
              ...row,
              result: status,
              deliveryRetry: undefined,
              workerRunId,
              workerReportDeadline:
                row.workerReportDeadline ?? workerReportDeadline(),
            });
          }
        } catch (error) {
          if (signal.aborted) return;
          const current = await deps.store.lookup(key);
          if (current) {
            const sameStage = current.deliveryRetry?.stage === stage;
            if (sameStage && stage === 'status read') continue;
            await deps.store.register(key, {
              ...current,
              deliveryRetry: nextHandoffRetry(stage, current.deliveryRetry),
            });
            if (!sameStage)
              deps.warn(
                `[tlon] Wallet handoff ${key} ${stage} failed (${handoffFailureReason(error)}); retrying.`
              );
          }
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
        void poll().catch(() =>
          deps.warn('[tlon] Wallet handoff store poll failed.')
        );
      }, 4000);
      timer.unref();
      void poll().catch(() =>
        deps.warn('[tlon] Wallet handoff store poll failed.')
      );
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
      resume: (request, runId) =>
        resumeBrowserContinuation(api.runtime, request, runId, (message) =>
          api.logger.warn(message)
        ),
      warn: (message) => api.logger.warn(message),
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
