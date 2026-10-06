import { randomUUID } from 'node:crypto';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { serviceStatusSchema } from './browser-task-store.js';
import { readMcpReply } from './browser-mcp-reply.js';
import { resolveBrowserHandoffAccount } from './tlon-command-runner.js';
import { ssrfPolicyFromAllowPrivateNetwork } from './urbit/context.js';
import { urbitFetch } from './urbit/fetch.js';

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Uses the existing authenticated proxy route; no client or chat message participates. */
export async function readBrowserTaskServiceStatus(
  config: OpenClawConfig,
  handle: string,
  signal?: AbortSignal
) {
  try {
    if (!/^sess_[A-Za-z0-9_-]{22}$/.test(handle)) throw new Error();
    const server = record(record(record(record(config).mcp).servers).mcp);
    if (
      server.transport !== 'streamable-http' ||
      server.enabled === false ||
      typeof server.url !== 'string'
    )
      throw new Error();
    const url = new URL(server.url);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/apps/mcp/mcp' ||
      url.search ||
      url.hash
    )
      throw new Error();
    const headers = record(server.headers);
    if (
      !Object.values(headers).every((v) => typeof v === 'string') ||
      !Object.entries(headers).some(
        ([k, v]) =>
          k.toLowerCase() === 'x-api-key' && typeof v === 'string' && v.trim()
      )
    )
      throw new Error();
    const id = randomUUID();
    const account = resolveBrowserHandoffAccount(config);
    const request = await urbitFetch({
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
            name: 'browser_browser_session_monitor',
            arguments: { session_id: handle },
          },
        }),
      },
      ssrfPolicy: ssrfPolicyFromAllowPrivateNetwork(
        account.allowPrivateNetwork
      ),
      timeoutMs: 5000,
      maxRedirects: 0,
      auditContext: 'tlon-browser-task-monitor',
    });
    try {
      const reply = record(await readMcpReply(request.response, id));
      const result = record(reply.result),
        metadata = record(result.structuredContent);
      if (
        reply.jsonrpc !== '2.0' ||
        reply.id !== id ||
        reply.error ||
        result.isError ||
        metadata.session_id !== handle
      )
        throw new Error();
      return serviceStatusSchema.parse(metadata.monitor);
    } finally {
      await request.release();
    }
  } catch {
    throw new Error('Browser monitoring status unavailable.');
  }
}
