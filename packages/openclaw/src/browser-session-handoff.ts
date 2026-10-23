import { randomUUID } from 'node:crypto';
import {
  isTrustedBrowserViewerHost,
  isBrowserViewerDevelopmentOrigin,
  MAX_BROWSER_VIEWER_URL_LENGTH,
} from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { z } from 'zod';

import {
  resolveBrowserHandoffAccount,
  runBrowserHandoffCommand,
} from './tlon-command-runner.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';
import type { BrowserHandoffRequest } from './browser-handoff-results.js';

export const BROWSER_SESSION_HANDOFF_HELP = String.raw`Usage: browser handoff <session_id> --fields <JSON array> or browser approve-login <session_id> --fields <JSON array> [--record <JSON object>] or browser share <session_id> (the session ID from browser_session_create). Both secure-entry commands require --fields. The card fills only those controls; the agent inspects the page and chooses the next action. Prefer current snapshot refs: browser handoff <session_id> --fields '["@e12","@e13"]'. Exact {"name":"..."}/{"label":"..."} selectors must match uniquely. For labels containing apostrophes, encode the apostrophe as \u0027 inside the single-quoted JSON: browser handoff <session_id> --fields '[{"label":"Owner\u0027s email address"}]'. Do not supply a viewer URL or field values.`;

export const formFieldsSchema = z
  .array(
    z.union([
      z.string().regex(/^@e\d+$/),
      z.object({ name: z.string().min(1).max(512) }).strict(),
      z.object({ label: z.string().min(1).max(1024) }).strict(),
    ])
  )
  .min(1)
  .max(40);
export type FormFields = z.infer<typeof formFieldsSchema>;

const LOOKUP_DEADLINE_MS = 15_000;
const LOOKUP_ATTEMPT_TIMEOUT_MS = 5_000;
const LOOKUP_MAX_ATTEMPTS = 3;
const PREPARE_TIMEOUT_MS = 30_000;
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
class BrowserSelectionRejectedError extends Error {}

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

function validateViewerUrl(value: unknown, selected = false): string {
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
    payload.exp <= Math.floor(Date.now() / 1000) ||
    (selected &&
      (typeof payload.form !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          payload.form
        )))
  ) {
    throw new Error('Invalid browser viewer scope or deadline.');
  }
  return value;
}

/** The ship's stateless aggregate proxy owns upstream MCP sessions and headers. */
async function resolveViewerUrl(
  handle: string,
  config: OpenClawConfig,
  allowPrivateNetwork: boolean | null,
  prepareForm: boolean,
  fields?: FormFields
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
    // Preparation mints a capability. A timed-out request may still complete
    // upstream, so give it one longer attempt rather than create duplicate forms.
    const maxAttempts = prepareForm ? 1 : LOOKUP_MAX_ATTEMPTS;
    const deadline =
      Date.now() + (prepareForm ? PREPARE_TIMEOUT_MS : LOOKUP_DEADLINE_MS);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
                arguments: {
                  session_id: handle,
                  ...(prepareForm
                    ? { action: 'prepare_form', ...(fields ? { fields } : {}) }
                    : {}),
                },
              },
            }),
          },
          ssrfPolicy: ssrfPolicyFromAllowPrivateNetwork(allowPrivateNetwork),
          timeoutMs: prepareForm
            ? remainingMs
            : Math.min(LOOKUP_ATTEMPT_TIMEOUT_MS, remainingMs),
          maxRedirects: 0,
          auditContext: 'tlon-browser-handoff',
        });
        try {
          if (
            [408, 500, 502, 503, 504].includes(request.response.status) ||
            (fields && request.response.status === 429)
          ) {
            await request.response.body?.cancel();
            throw new TransientBrowserLookupError(
              'Browser lookup unavailable.'
            );
          }
          const reply = record(await readMcpReply(request.response, id));
          const result = record(reply.result);
          const metadata = record(result.structuredContent);
          if (reply.jsonrpc !== '2.0' || reply.id !== id || reply.error) {
            throw new Error('Browser session lookup refused.');
          }
          if (result.isError) {
            const upstreamError = record(metadata.error);
            const code = upstreamError.code;
            const status = record(upstreamError.details).status;
            if (
              fields &&
              typeof code === 'string' &&
              ['stale_ref', 'ref_not_found', 'invalid_argument'].includes(code)
            ) {
              throw new BrowserSelectionRejectedError();
            }
            if (
              fields &&
              ((typeof code === 'string' &&
                [
                  'timeout',
                  'rate_limited',
                  'session_busy',
                  'session_releasing',
                ].includes(code)) ||
                (code === 'steel_error' &&
                  typeof status === 'number' &&
                  [408, 429, 500, 502, 503, 504].includes(status)))
            ) {
              throw new TransientBrowserLookupError();
            }
            throw new Error('Browser session lookup refused.');
          }
          if (metadata.session_id !== handle) {
            throw new Error('Browser session lookup refused.');
          }
          return validateViewerUrl(metadata.viewer_url, prepareForm);
        } finally {
          await request.release();
        }
      } catch (error) {
        const delayMs = 500 * 2 ** attempt;
        if (
          !isTransientLookupError(error) ||
          attempt + 1 === maxAttempts ||
          Date.now() + delayMs >= deadline
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Browser lookup attempts exhausted.');
  } catch (error) {
    // Transport and upstream errors can contain bearer URLs or tenant headers.
    if (!fields)
      throw new Error('Could not resolve a live browser session for handoff.');
    if (error instanceof BrowserSelectionRejectedError) {
      throw new Error(
        'Could not prepare the selected fields. Take a fresh browser snapshot, select unique visible controls, and retry the handoff.'
      );
    }
    if (isTransientLookupError(error)) {
      throw new Error(
        'Could not prepare the selected fields because the browser service is temporarily unavailable or timed out. Try again shortly.'
      );
    }
    throw new Error(
      'Could not prepare the selected fields because the browser service is unavailable. Report the failure to the owner and check the browser service configuration.'
    );
  }
}

/** The model names a session; only trusted code handles its signed capability. */
export async function runBrowserSessionHandoff(
  binary: string,
  args: string[],
  config: OpenClawConfig,
  watchHandoff?: (
    request: BrowserHandoffRequest
  ) => Promise<() => Promise<void>>
): Promise<string> {
  if (
    args[0] === 'browser' &&
    (args.length === 1 || args.some((arg) => ['--help', '-h'].includes(arg)))
  ) {
    return BROWSER_SESSION_HANDOFF_HELP;
  }
  if (
    ![3, 5, 7].includes(args.length) ||
    args[0] !== 'browser' ||
    !['handoff', 'share', 'approve-login'].includes(args[1]) ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(args[2])
  )
    throw new Error(BROWSER_SESSION_HANDOFF_HELP);
  let fields: FormFields | undefined;
  let loginRecord: { id: string; revision: number } | undefined;
  try {
    for (let i = 3; i < args.length; i += 2) {
      if (args[i + 1].length > 16_384) throw new Error('Argument too large.');
      if (args[i] === '--fields' && args[1] !== 'share' && !fields)
        fields = formFieldsSchema.parse(JSON.parse(args[i + 1]));
      else if (
        args[i] === '--record' &&
        args[1] === 'approve-login' &&
        !loginRecord
      )
        loginRecord = z
          .object({ id: z.uuid(), revision: z.number().int().positive() })
          .strict()
          .parse(JSON.parse(args[i + 1]));
      else throw new Error('Invalid option.');
    }
    if (args[1] !== 'share' && !fields) throw new Error('Select fields first.');
  } catch {
    throw new Error(BROWSER_SESSION_HANDOFF_HELP);
  }
  const account = resolveBrowserHandoffAccount(config);
  if (args[1] !== 'share' && !watchHandoff)
    throw new Error('Secure entry requires result delivery to the agent.');
  const viewerUrl = await resolveViewerUrl(
    args[2],
    config,
    account.allowPrivateNetwork,
    args[1] !== 'share',
    fields
  );
  const cancelWatch =
    args[1] !== 'share'
      ? await watchHandoff!({ browserSessionId: args[2], viewerUrl })
      : undefined;
  try {
    await runBrowserHandoffCommand(
      binary,
      [
        'browser',
        args[1],
        viewerUrl,
        ...(loginRecord ? ['--record', JSON.stringify(loginRecord)] : []),
        ...(args[1] !== 'share' ? ['--service-result'] : []),
      ],
      config
    );
    return (
      `✓ ${args[1] === 'share' ? 'Browser session' : args[1] === 'approve-login' ? 'Saved login approval' : 'Secure browser form'} sent to ${account.ownerShip}` +
      (args[1] === 'share'
        ? ''
        : '. Wait for the secure-entry result before using this browser again. The service resumes this conversation after entry.')
    );
  } catch {
    await cancelWatch?.();
    throw new Error(
      args[1] === 'share'
        ? 'Could not send the browser session card.'
        : 'Could not send the secure browser form.'
    );
  }
}
