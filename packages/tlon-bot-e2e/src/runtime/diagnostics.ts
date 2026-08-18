import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ComposeHandle, RuntimeContext } from '../drivers/types.js';
import {
  type DockerCommandRunner,
  inspectComposeServiceState,
  topComposeService,
} from './docker-direct.js';

const DEFAULT_LOG_TAIL = 240;
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
const DEFAULT_COMPOSE_TIMEOUT_MS = 10_000;
const SHIPS_LOG_FETCH_TIMEOUT_MS = 30_000;

export async function collectRuntimeDiagnostics(
  ctx: RuntimeContext,
  compose: ComposeHandle,
  opts: {
    tail?: number;
    probeTimeoutMs?: number;
    composeTimeoutMs?: number;
    dockerRunner?: DockerCommandRunner;
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
    section(`${ctx.services.bot} upload log lines`, async () =>
      filterUploadLogLines(
        await compose.logs([ctx.services.bot], {
          timeoutMs: composeTimeoutMs,
          allowFailure: false,
        })
      )
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
    section('container states', () =>
      containerStatesSnapshot(ctx, composeTimeoutMs, opts.dockerRunner)
    ),
    section(`${ctx.services.ships} process table`, () =>
      topComposeService(
        ctx,
        ctx.services.ships,
        { timeoutMs: composeTimeoutMs },
        opts.dockerRunner
      )
    ),
  ]);

  return sections.filter(Boolean).join('\n\n');
}

export async function writeDiagnosticsArtifacts(
  ctx: RuntimeContext,
  compose: ComposeHandle,
  dir: string,
  dump: string
): Promise<string> {
  const outDir = path.join(dir, ctx.runId);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'diagnostics.txt'), dump, 'utf8');
  let shipsLogs: string;
  try {
    // allowFailure: false is load-bearing: logs() defaults it to true, in
    // which case a failed compose command returns junk instead of throwing
    // and the placeholder path below would never run.
    shipsLogs = await compose.logs([ctx.services.ships], {
      timeoutMs: SHIPS_LOG_FETCH_TIMEOUT_MS,
      allowFailure: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    shipsLogs = `<failed to collect ships logs: ${message}>`;
  }
  await writeFile(path.join(outDir, 'ships.log'), shipsLogs, 'utf8');
  return outDir;
}

async function containerStatesSnapshot(
  ctx: RuntimeContext,
  timeoutMs: number,
  run: DockerCommandRunner | undefined
): Promise<string> {
  const services = [
    ctx.services.bot,
    ctx.services.fakeModel,
    ctx.services.ships,
  ];
  const blocks = await Promise.all(
    services.map(async (service) => {
      try {
        const state = await inspectComposeServiceState(
          ctx,
          service,
          { timeoutMs },
          run
        );
        return `${service}:\n${state}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `${service}: <failed to collect: ${message}>`;
      }
    })
  );
  return blocks.join('\n');
}

export function filterUploadLogLines(logs: string): string {
  const matching = logs
    .split('\n')
    .filter((line) => line.includes('[tlon] upload'));
  if (matching.length === 0) {
    return '';
  }
  if (matching.length > 400) {
    const kept = matching.slice(-400);
    return `<truncated: showing last 400 of ${matching.length} matching lines>\n${kept.join('\n')}`;
  }
  return matching.join('\n');
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
