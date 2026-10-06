import { readMcpReply } from './browser-mcp-reply.js';
import { randomUUID } from 'node:crypto';
import { prepareBrowserTaskHandoff } from './browser-task-runtime.js';
import {
  browserSessionTelemetryId,
  reportBrowserLifecycle,
  type BrowserAgentContext,
} from './browser-telemetry.js';
import {
  isTrustedBrowserViewerHost,
  MAX_BROWSER_VIEWER_URL_LENGTH,
} from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import {
  resolveBrowserHandoffAccount,
  runBrowserHandoffCommand,
} from './tlon-command-runner.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';

export const BROWSER_SESSION_HANDOFF_HELP =
  'Usage: browser handoff <session_id> (the sess_ handle from browser_session_create). Do not supply a viewer URL.';

const LOOKUP_DEADLINE_MS = 15_000;
const LOOKUP_ATTEMPT_TIMEOUT_MS = 5_000;
const LOOKUP_MAX_ATTEMPTS = 3;
const TRANSIENT_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

class TransientBrowserLookupError extends Error {}

function isTransientLookupError(error: unknown): boolean {
  for (let depth = 0; error && depth < 5; depth++) {
    if (error instanceof TransientBrowserLookupError) return true;
    const cause = record(error);
    if (
      (typeof cause.code === 'string' &&
        TRANSIENT_NETWORK_CODES.has(cause.code)) ||
      cause.name === 'TimeoutError' ||
      cause.name === 'AbortError'
    )
      return true;
    error = cause.cause;
  }
  return false;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function validateViewerUrl(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > MAX_BROWSER_VIEWER_URL_LENGTH
  ) {
    throw new Error('Missing browser viewer URL.');
  }
  const url = new URL(value);
  const capability = /^\/s\/([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(
    url.pathname
  );
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !isTrustedBrowserViewerHost(url.hostname) ||
    !capability
  ) {
    throw new Error('Invalid browser viewer URL.');
  }
  // The authenticated browser service supplies the signature. Check the public
  // scope and deadline, but preserve the entire signed URL byte for byte.
  const payload = record(
    JSON.parse(Buffer.from(capability[1], 'base64url').toString('utf8'))
  );
  if (
    payload.v !== 1 ||
    payload.aud !== 'session-viewer' ||
    typeof payload.sid !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.sid
    ) ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Invalid browser viewer scope or deadline.');
  }
  return value;
}

/** The ship's stateless aggregate proxy owns upstream MCP sessions and headers. */
async function resolveViewerUrl(
  handle: string,
  config: OpenClawConfig,
  allowPrivateNetwork: boolean | null
): Promise<string> {
  try {
    const server = record(record(record(record(config).mcp).servers).mcp);
    if (
      server.transport !== 'streamable-http' ||
      server.enabled === false ||
      typeof server.url !== 'string'
    ) {
      throw new Error('Missing configured MCP proxy.');
    }
    const url = new URL(server.url);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/apps/mcp/mcp' ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid configured MCP proxy.');
    }
    const headers = record(server.headers);
    if (
      !Object.values(headers).every((value) => typeof value === 'string') ||
      !Object.entries(headers).some(
        ([name, value]) =>
          name.toLowerCase() === 'x-api-key' &&
          typeof value === 'string' &&
          value.trim()
      )
    ) {
      throw new Error('Missing configured MCP proxy credential.');
    }
    const deadline = Date.now() + LOOKUP_DEADLINE_MS;
    for (let attempt = 0; attempt < LOOKUP_MAX_ATTEMPTS; attempt++) {
      try {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0)
          throw new Error('Browser lookup deadline reached.');
        const id = randomUUID();
        const request = await urbitFetch({
          baseUrl: url.origin,
          path: url.pathname,
          init: {
            method: 'POST',
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
                name: 'browser_browser_session_live_view',
                arguments: { session_id: handle },
              },
            }),
          },
          ssrfPolicy: ssrfPolicyFromAllowPrivateNetwork(allowPrivateNetwork),
          timeoutMs: Math.min(LOOKUP_ATTEMPT_TIMEOUT_MS, remainingMs),
          maxRedirects: 0,
          auditContext: 'tlon-browser-handoff',
        });
        try {
          if ([408, 500, 502, 503, 504].includes(request.response.status)) {
            await request.response.body?.cancel();
            throw new TransientBrowserLookupError(
              'Browser lookup unavailable.'
            );
          }
          const reply = record(await readMcpReply(request.response, id));
          const result = record(reply.result);
          const metadata = record(result.structuredContent);
          if (
            reply.jsonrpc !== '2.0' ||
            reply.id !== id ||
            reply.error ||
            result.isError ||
            metadata.session_id !== handle
          ) {
            throw new Error('Browser session lookup refused.');
          }
          return validateViewerUrl(metadata.viewer_url);
        } finally {
          await request.release();
        }
      } catch (error) {
        const delayMs = 500 * 2 ** attempt;
        if (
          !isTransientLookupError(error) ||
          attempt + 1 === LOOKUP_MAX_ATTEMPTS ||
          Date.now() + delayMs >= deadline
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Browser lookup attempts exhausted.');
  } catch {
    // Transport and upstream errors can contain bearer URLs or tenant headers.
    throw new Error('Could not resolve a live browser session for handoff.');
  }
}

/** The model names a session; only trusted code handles its signed capability. */
export async function runBrowserSessionHandoff(
  binary: string,
  args: string[],
  config: OpenClawConfig,
  context: BrowserAgentContext = {}
): Promise<string> {
  if (
    args[0] === 'browser' &&
    (args.length === 1 || args.some((arg) => ['--help', '-h'].includes(arg)))
  ) {
    return BROWSER_SESSION_HANDOFF_HELP;
  }
  if (
    args.length !== 3 ||
    args[0] !== 'browser' ||
    args[1] !== 'handoff' ||
    !/^sess_[A-Za-z0-9_-]{22}$/.test(args[2])
  ) {
    throw new Error(BROWSER_SESSION_HANDOFF_HELP);
  }
  const telemetry = {
    browserTaskId: undefined as string | undefined,
    browserSessionId: browserSessionTelemetryId(args[2])!,
    browserHandoffId: randomUUID(),
  };
  const startedAt = Date.now();
  const report = (
    phase: 'handoff_requested' | 'handoff_ready' | 'handoff_failed',
    outcome: 'accepted' | 'failed' | 'unknown',
    reason?: 'lookup_failed' | 'delivery_failed'
  ) =>
    reportBrowserLifecycle(
      {
        ...telemetry,
        source: 'agent',
        phase,
        outcome,
        reason,
        durationMs: Date.now() - startedAt,
      },
      context
    );
  telemetry.browserTaskId = report('handoff_requested', 'unknown');
  let viewerUrl: string;
  let ownerShip: string;
  try {
    const account = resolveBrowserHandoffAccount(config);
    ownerShip = account.ownerShip;
    viewerUrl = await resolveViewerUrl(
      args[2],
      config,
      account.allowPrivateNetwork
    );
  } catch (error) {
    report('handoff_failed', 'failed', 'lookup_failed');
    throw error;
  }
  try {
    await prepareBrowserTaskHandoff(
      args[2],
      context,
      telemetry.browserHandoffId
    );
    await runBrowserHandoffCommand(
      binary,
      ['browser', 'handoff', viewerUrl],
      config,
      telemetry
    );
    report('handoff_ready', 'accepted');
    return `✓ Secure browser form sent to ${ownerShip}`;
  } catch {
    report('handoff_failed', 'failed', 'delivery_failed');
    throw new Error('Could not send the secure browser form.');
  }
}
