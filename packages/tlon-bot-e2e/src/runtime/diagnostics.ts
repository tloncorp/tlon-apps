import type { ComposeHandle, RuntimeContext } from '../drivers/types.js';

const DEFAULT_LOG_TAIL = 240;
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
const DEFAULT_COMPOSE_TIMEOUT_MS = 10_000;

export async function collectRuntimeDiagnostics(
  ctx: RuntimeContext,
  compose: ComposeHandle,
  opts: {
    tail?: number;
    probeTimeoutMs?: number;
    composeTimeoutMs?: number;
  } = {}
): Promise<string> {
  const tail = opts.tail ?? DEFAULT_LOG_TAIL;
  const probeTimeoutMs = opts.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const composeTimeoutMs = opts.composeTimeoutMs ?? DEFAULT_COMPOSE_TIMEOUT_MS;
  const sections = await Promise.all([
    section('compose services', () =>
      composeServiceSnapshot(compose, composeTimeoutMs)
    ),
    section('fake-model received calls', () =>
      fakeModelReceivedDump(ctx, probeTimeoutMs)
    ),
    section(`${ctx.services.bot} logs`, () =>
      compose.logs([ctx.services.bot], { tail, timeoutMs: composeTimeoutMs })
    ),
    section(`${ctx.services.fakeModel} logs`, () =>
      compose.logs([ctx.services.fakeModel], {
        tail,
        timeoutMs: composeTimeoutMs,
      })
    ),
    section('ship readiness snapshot', () =>
      shipReadinessSnapshot(ctx, probeTimeoutMs)
    ),
    section(`${ctx.services.ships} logs`, () =>
      compose.logs([ctx.services.ships], { tail, timeoutMs: composeTimeoutMs })
    ),
  ]);

  return sections.filter(Boolean).join('\n\n');
}

async function composeServiceSnapshot(
  compose: ComposeHandle,
  timeoutMs: number
): Promise<string> {
  const services = await compose.ps({ timeoutMs });
  if (services.length === 0) {
    return 'No compose services are currently reported.';
  }
  return services
    .map((service) => {
      return [
        service.service || '<unknown-service>',
        service.state || '<unknown-state>',
        service.status || '<unknown-status>',
        service.name ? `(${service.name})` : '',
      ]
        .filter(Boolean)
        .join(' ');
    })
    .join('\n');
}

async function fakeModelReceivedDump(
  ctx: RuntimeContext,
  timeoutMs: number
): Promise<string> {
  const received = await fetchJsonWithTimeout(
    `${ctx.endpoints.fakeModel.hostBaseUrl}/v1/_received`,
    timeoutMs
  );
  return JSON.stringify(received, null, 2);
}

async function shipReadinessSnapshot(
  ctx: RuntimeContext,
  timeoutMs: number
): Promise<string> {
  const snapshots = await Promise.all(
    Object.entries(ctx.endpoints.ships).map(async ([label, endpoint]) => {
      try {
        const response = await fetchWithTimeout(
          `${endpoint.hostUrl}/~/login`,
          {
            method: 'POST',
            body: new URLSearchParams({ password: endpoint.code }),
            redirect: 'manual',
          },
          timeoutMs
        );
        const cookie = response.headers.get('set-cookie') ?? '';
        return (
          `${label} ${endpoint.ship} ${endpoint.hostUrl}/~/login ` +
          `status=${response.status} ok=${response.ok} urbauth=${cookie.includes(
            'urbauth'
          )}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `${label} ${endpoint.ship} ${endpoint.hostUrl}/~/login error=${message}`;
      }
    })
  );
  return snapshots.join('\n');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `fake-model received dump failed: ${response.status} ${detail}`
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function section(
  title: string,
  collect: () => Promise<string>
): Promise<string> {
  try {
    const body = await collect();
    return `== ${title} ==\n${body.trim() || '<empty>'}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `== ${title} ==\n<failed to collect: ${message}>`;
  }
}
