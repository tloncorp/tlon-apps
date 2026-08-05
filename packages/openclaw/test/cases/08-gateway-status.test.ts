/**
 * Live gateway-status regression coverage (TLON-6132).
 *
 * Test 1 is the sensitivity guard: on prewarming cores, a forced Tlon monitor
 * restart must establish a new lease and then renew it from the replacement
 * monitor. Test 2 is omitted because rube-27's archived activity feed does not
 * advance the old agent's owner-activity; a regenerated steward pier can cover
 * it later.
 */
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type BoundedNounClient,
  type GatewayStatusScry,
  assertOpenClawContainerRunning,
  createBoundedNounClient,
  decodeGatewayStatus,
  getContainerLogsSince,
  getTestConfig,
  setGatewayStatusRestartConfig,
} from '../lib/index.js';

const ARCHIVE = 'pinned rube-zod27';
// Must match dev/Dockerfile.test's ARG OPENCLAW_CORE_VERSION default: the test
// asserts the container's installed core equals this requested version. Bumping
// both together to 2026.6.11/2026.7.1 (already in the known-prewarm map below)
// promotes this case from a 5.28 smoke test to the full prewarm regression guard.
const DEFAULT_CORE_VERSION = '2026.5.28';
const HARD_TEST_TIMEOUT_MS = 180_000;
const INTERNAL_TEST_TIMEOUT_MS = 165_000;
const DIAGNOSTIC_RESERVE_MS = 12_000;
const MIN_POLL_OPERATION_BUDGET_MS = 2_000;
const STATUS_SCRY = {
  app: 'gateway-status',
  path: '/status',
  archive: ARCHIVE,
} as const;
const GATEWAY_START = '[gateway-status] gateway_start received (generation=1)';
const ACTIVATED = '[gateway-status] activated (';
const REGISTERING_TOOL = '[tlon] Registering tlon tool, binary:';
const PREWARM_RE = /agent runtime plugins pre-warmed in \d+ms/;
const RESTARTING_CHANNEL = 'restarting tlon channel';
const STARTING_MONITOR = '[tlon] Starting monitor for ~zod';
const CORE_VERSION_RE =
  /\[tlon-e2e\] openclaw-core-version=([^\s]+) requested=([^\s]+)/g;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function evidence(message: string): void {
  process.stdout.write(`${message}\n`);
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function nthIndex(
  haystack: string,
  needle: string,
  occurrence: number
): number {
  let offset = 0;
  for (let current = 1; current <= occurrence; current += 1) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) {
      return -1;
    }
    if (current === occurrence) {
      return index;
    }
    offset = index + needle.length;
  }
  return -1;
}

function regexIndexAfter(logs: string, regex: RegExp, after: number): number {
  const sliced = logs.slice(after);
  const match = sliced.match(regex);
  return match?.index == null ? -1 : after + match.index;
}

function lineAt(logs: string, index: number): string {
  if (index < 0) {
    return '<missing>';
  }
  const start = logs.lastIndexOf('\n', index) + 1;
  const end = logs.indexOf('\n', index);
  return logs.slice(start, end < 0 ? undefined : end).trim();
}

function lastLogLines(logs: string, count = 100): string {
  return logs.trim().split(/\r?\n/).slice(-count).join('\n');
}

function statusSummary(status: GatewayStatusScry | null): string {
  if (!status) {
    return '<none>';
  }
  return `${status.status} lease=${status.leaseUntil ?? 'null'} raw=${status.raw}`;
}

function markerSummary(logs: string): string {
  return [
    `${GATEWAY_START} count=${countOccurrences(logs, GATEWAY_START)}`,
    `${ACTIVATED} count=${countOccurrences(logs, ACTIVATED)}`,
    `${REGISTERING_TOOL} count=${countOccurrences(logs, REGISTERING_TOOL)}`,
    `${RESTARTING_CHANNEL} count=${countOccurrences(logs, RESTARTING_CHANNEL)}`,
    `${STARTING_MONITOR} count=${countOccurrences(logs, STARTING_MONITOR)}`,
  ].join('; ');
}

function readPrewarmExpectation(coreVersion: string): boolean {
  const raw = process.env.TEST_EXPECT_OPENCLAW_PREWARM;
  if (raw != null && raw !== '0' && raw !== '1') {
    throw new Error(
      `TEST_EXPECT_OPENCLAW_PREWARM must be 0 or 1 for core ${coreVersion}`
    );
  }
  const known: Record<string, boolean> = {
    '2026.5.28': false,
    '2026.6.11': true,
    '2026.7.1': true,
  };
  if (raw == null) {
    if (!(coreVersion in known)) {
      throw new Error(
        `TEST_EXPECT_OPENCLAW_PREWARM must be explicit for unknown core ${coreVersion}`
      );
    }
    return known[coreVersion];
  }
  const explicit = raw === '1';
  if (coreVersion in known) {
    expect(
      explicit,
      `wrong prewarm expectation for known OpenClaw core ${coreVersion}`
    ).toBe(known[coreVersion]);
  }
  return explicit;
}

function remainingTimeout(
  deadline: number,
  maximumMs: number,
  operation: string
): number {
  const remainingMs = Math.floor(deadline - Date.now());
  if (remainingMs <= 0) {
    throw new Error(
      `Internal ${INTERNAL_TEST_TIMEOUT_MS}ms deadline exhausted before ${operation}`
    );
  }
  return Math.min(maximumMs, remainingMs);
}

function phaseDeadline(overallDeadline: number, windowMs: number): number {
  return Math.min(
    Date.now() + windowMs,
    overallDeadline - DIAGNOSTIC_RESERVE_MS
  );
}

function canStartPoll(deadline: number): boolean {
  return Date.now() + MIN_POLL_OPERATION_BUDGET_MS < deadline;
}

async function sleepWithin(deadline: number, maximumMs: number): Promise<void> {
  await sleep(remainingTimeout(deadline, maximumMs, 'poll sleep'));
}

function startupIndices(
  logs: string,
  expectPrewarm: boolean
): {
  gatewayStart: number;
  activated: number;
  registering: number;
  prewarm: number;
} {
  const gatewayStart = logs.indexOf(GATEWAY_START);
  const activated = logs.indexOf(
    ACTIVATED,
    gatewayStart + GATEWAY_START.length
  );
  const registering = expectPrewarm
    ? logs.indexOf(REGISTERING_TOOL, gatewayStart + GATEWAY_START.length)
    : -1;
  const prewarm = expectPrewarm
    ? regexIndexAfter(logs, PREWARM_RE, registering + REGISTERING_TOOL.length)
    : -1;
  return { gatewayStart, activated, registering, prewarm };
}

function startupReady(logs: string, expectPrewarm: boolean): boolean {
  const indices = startupIndices(logs, expectPrewarm);
  if (indices.gatewayStart < 0 || indices.activated <= indices.gatewayStart) {
    return false;
  }
  return (
    !expectPrewarm ||
    (indices.registering > indices.gatewayStart &&
      indices.prewarm > indices.registering)
  );
}

describe('gateway-status lifecycle', () => {
  let nounClient: BoundedNounClient;
  let composeFile: string;

  const readLogs = (deadline: number): string => {
    assertOpenClawContainerRunning(
      composeFile,
      remainingTimeout(deadline, 10_000, 'container liveness check')
    );
    return getContainerLogsSince(
      composeFile,
      new Date(0).toISOString(),
      remainingTimeout(deadline, 10_000, 'container log read')
    );
  };

  const readStatus = async (deadline: number): Promise<GatewayStatusScry> => {
    assertOpenClawContainerRunning(
      composeFile,
      remainingTimeout(deadline, 10_000, 'status container liveness check')
    );
    const remainingMs = remainingTimeout(
      deadline,
      30_000,
      'gateway status noun scry'
    );
    // noun-scry bounds each possible auth/fetch/retry phase separately. Give
    // each phase a fraction of the remaining operation budget so the complete
    // request cannot consume the test's internal overall deadline.
    const timeoutMs = Math.max(1, Math.floor(remainingMs / 6));
    return decodeGatewayStatus(
      await nounClient.scry({ ...STATUS_SCRY, timeoutMs })
    );
  };

  const waitForLogs = async (
    description: string,
    timeoutMs: number,
    overallDeadline: number,
    predicate: (logs: string) => boolean
  ): Promise<string> => {
    const deadline = phaseDeadline(overallDeadline, timeoutMs);
    let logs = '';
    while (canStartPoll(deadline)) {
      logs = readLogs(deadline);
      if (predicate(logs)) {
        return logs;
      }
      await sleepWithin(deadline, 1_000);
    }
    throw new Error(
      `Timed out waiting for ${description}. ${markerSummary(logs)}\n` +
        `Last 100 OpenClaw log lines:\n${lastLogLines(logs)}`
    );
  };

  beforeAll(() => {
    const config = getTestConfig();
    nounClient = createBoundedNounClient(config.bot);
    composeFile = process.env.TEST_COMPOSE_FILE ?? '';
    if (!composeFile) {
      throw new Error('TEST_COMPOSE_FILE is required');
    }
    if (!process.env.TEST_COMPOSE_PROJECT_NAME) {
      throw new Error('TEST_COMPOSE_PROJECT_NAME is required for isolation');
    }
  });

  test(
    'survives prewarm, forced monitor restart, and two-stage lease renewal',
    async () => {
      const overallDeadline = Date.now() + INTERNAL_TEST_TIMEOUT_MS;
      const requestedVersion =
        process.env.TEST_OPENCLAW_CORE_VERSION ?? DEFAULT_CORE_VERSION;
      const expectPrewarm = readPrewarmExpectation(requestedVersion);

      const startupLogs = await waitForLogs(
        'ordered gateway startup/prewarm evidence',
        25_000,
        overallDeadline,
        (logs) => startupReady(logs, expectPrewarm)
      );
      const versionMarkers = [...startupLogs.matchAll(CORE_VERSION_RE)];
      const lastVersionMarker = versionMarkers.at(-1);
      expect(
        lastVersionMarker,
        'installed core version marker is missing'
      ).toBeDefined();
      expect(lastVersionMarker?.[1], 'installed core version').toBe(
        requestedVersion
      );
      expect(lastVersionMarker?.[2], 'requested core version marker').toBe(
        requestedVersion
      );

      const startup = startupIndices(startupLogs, expectPrewarm);
      evidence(`[gateway-status-e2e] core=${requestedVersion}`);
      evidence(
        `[gateway-status-e2e] ${lineAt(startupLogs, startup.gatewayStart)}`
      );
      evidence(
        `[gateway-status-e2e] ${lineAt(startupLogs, startup.activated)}`
      );
      if (expectPrewarm) {
        evidence(
          `[gateway-status-e2e] ${lineAt(startupLogs, startup.registering)}`
        );
        evidence(
          `[gateway-status-e2e] ${lineAt(startupLogs, startup.prewarm)}`
        );
      } else {
        evidence('[gateway-status-e2e] prewarm assertion skipped (5.28 smoke)');
      }

      // Observe a real heartbeat lease advance before taking L0. Mutating just
      // after this leaves nearly a full 30-second interval before any stale
      // monitor callback could run, making the post-restart stages unambiguous.
      const seed = await readStatus(overallDeadline);
      if (
        seed.status !== 'up' ||
        seed.leaseUntil == null ||
        seed.leaseUntil <= Date.now()
      ) {
        throw new Error(
          `Initial gateway ship liveness failed: ${statusSummary(seed)}`
        );
      }
      const heartbeatDeadline = phaseDeadline(overallDeadline, 36_000);
      let baseline: GatewayStatusScry | null = null;
      let lastStatus: GatewayStatusScry | null = seed;
      while (canStartPoll(heartbeatDeadline)) {
        const current = await readStatus(heartbeatDeadline);
        lastStatus = current;
        if (
          current.status === 'up' &&
          current.leaseUntil != null &&
          current.leaseUntil > seed.leaseUntil
        ) {
          baseline = current;
          break;
        }
        await sleepWithin(heartbeatDeadline, 500);
      }
      if (!baseline?.leaseUntil) {
        const logs = readLogs(overallDeadline);
        throw new Error(
          `Initial gateway heartbeat did not advance the ship lease; ` +
            `seed=${seed.leaseUntil}, L0=absent, last=${statusSummary(lastStatus)}. ` +
            `${markerSummary(logs)}\nLast 100 OpenClaw log lines:\n${lastLogLines(logs)}`
        );
      }
      const l0 = baseline.leaseUntil;
      evidence(
        `[gateway-status-e2e] L0=${l0} observed immediately after pre-restart heartbeat`
      );

      await sleepWithin(overallDeadline, 1_500);
      const preMutationLogs = readLogs(overallDeadline);
      const mutationBoundary = preMutationLogs.length;
      const restartCountBefore = countOccurrences(
        preMutationLogs,
        RESTARTING_CHANNEL
      );
      const monitorCountBefore = countOccurrences(
        preMutationLogs,
        STARTING_MONITOR
      );
      const configDeadline = phaseDeadline(overallDeadline, 20_000);
      const configResult = setGatewayStatusRestartConfig(
        composeFile,
        remainingTimeout(configDeadline, 20_000, 'config mutation')
      );
      evidence(
        `[gateway-status-e2e] config exit=${configResult.exitCode} ` +
          `${configResult.stdout.trim()} ${configResult.stderr.trim()}`.trim()
      );
      expect(configResult.exitCode, 'config mutation must exit 0').toBe(0);
      assertOpenClawContainerRunning(
        composeFile,
        remainingTimeout(overallDeadline, 10_000, 'post-config liveness check')
      );

      const restartLogs = await waitForLogs(
        'forced Tlon channel restart and replacement monitor',
        20_000,
        overallDeadline,
        (logs) => {
          const restartIndex = nthIndex(
            logs,
            RESTARTING_CHANNEL,
            restartCountBefore + 1
          );
          const monitorIndex = nthIndex(
            logs,
            STARTING_MONITOR,
            monitorCountBefore + 1
          );
          return (
            restartIndex >= mutationBoundary &&
            monitorIndex >= mutationBoundary &&
            (!expectPrewarm || monitorIndex > startup.prewarm)
          );
        }
      );
      const restartIndex = nthIndex(
        restartLogs,
        RESTARTING_CHANNEL,
        restartCountBefore + 1
      );
      const monitorIndex = nthIndex(
        restartLogs,
        STARTING_MONITOR,
        monitorCountBefore + 1
      );
      evidence(`[gateway-status-e2e] ${lineAt(restartLogs, restartIndex)}`);
      evidence(`[gateway-status-e2e] ${lineAt(restartLogs, monitorIndex)}`);

      // Stage 1 is one liveness assertion: the post-restart activation marker
      // gates acceptance of a ship lease advance, but a missing marker is
      // reported as failure to establish L1 rather than as a standalone log
      // assertion. This keeps deliberate broken-code REDs ship-state based.
      const stage1Deadline = phaseDeadline(overallDeadline, 20_000);
      let l1: number | null = null;
      lastStatus = null;
      let postRestartActivated = false;
      while (canStartPoll(stage1Deadline)) {
        const logs = readLogs(stage1Deadline);
        const activatedIndex = logs.indexOf(
          ACTIVATED,
          monitorIndex + STARTING_MONITOR.length
        );
        postRestartActivated = activatedIndex > monitorIndex;
        const current = await readStatus(stage1Deadline);
        lastStatus = current;
        if (
          postRestartActivated &&
          current.status === 'up' &&
          current.leaseUntil != null &&
          current.leaseUntil > l0 &&
          current.leaseUntil > Date.now()
        ) {
          l1 = current.leaseUntil;
          break;
        }
        await sleepWithin(stage1Deadline, 500);
      }
      if (l1 == null) {
        const logs = readLogs(overallDeadline);
        throw new Error(
          `Gateway liveness Stage 1 failed: replacement monitor did not establish ` +
            `a new live ship lease. L0=${l0}, L1=absent, ` +
            `postRestartActivated=${postRestartActivated}, last=${statusSummary(lastStatus)}. ` +
            `${markerSummary(logs)}\nLast 100 OpenClaw log lines:\n${lastLogLines(logs)}`
        );
      }
      evidence(`[gateway-status-e2e] L1=${l1} (> L0=${l0})`);

      // Stage 2's 45-second budget starts only after L1 is accepted. Requiring
      // both a second advance and >=45s remaining proves a replacement-monitor
      // heartbeat, not one stale callback from the torn-down monitor.
      const stage2Deadline = phaseDeadline(overallDeadline, 45_000);
      let l2: number | null = null;
      lastStatus = null;
      while (canStartPoll(stage2Deadline)) {
        const current = await readStatus(stage2Deadline);
        lastStatus = current;
        if (
          current.status === 'up' &&
          current.leaseUntil != null &&
          current.leaseUntil > l1 &&
          current.leaseUntil >= Date.now() + 45_000
        ) {
          l2 = current.leaseUntil;
          break;
        }
        await sleepWithin(stage2Deadline, 1_000);
      }
      if (l2 == null) {
        const logs = readLogs(overallDeadline);
        throw new Error(
          `Gateway liveness Stage 2 failed: replacement monitor did not renew ` +
            `its ship lease. L0=${l0}, L1=${l1}, L2=absent, ` +
            `last=${statusSummary(lastStatus)}. ${markerSummary(logs)}\n` +
            `Last 100 OpenClaw log lines:\n${lastLogLines(logs)}`
        );
      }
      evidence(`[gateway-status-e2e] L2=${l2} (> L1=${l1})`);
    },
    HARD_TEST_TIMEOUT_MS
  );
});
