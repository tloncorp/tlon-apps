import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MEMORY_SAMPLE_MIN_INTERVAL_MS,
  reportMemorySampleDiagnostic,
  resetMemorySampleThrottleForTest,
} from './memory-sample-telemetry.js';
import { createTlonTelemetry, setDebugTelemetryReporter } from './telemetry.js';

const postHogMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function MockPostHog() {
    return postHogMocks;
  }),
}));

const MIB = 1024 * 1024;
const T0 = 1_800_000_000_000;

function worker(script: string, threadId: number, usedMiB: number) {
  return {
    script,
    threadId,
    heapUsed: usedMiB * MIB,
    heapTotal: (usedMiB + 2) * MIB,
  };
}

function fullSample() {
  return {
    type: 'diagnostic.memory.sample',
    uptimeMs: 3_600_000,
    memory: {
      rssBytes: 1_500 * MIB,
      heapTotalBytes: 400 * MIB,
      heapUsedBytes: 350 * MIB,
      externalBytes: 20 * MIB,
      arrayBuffersBytes: 5 * MIB,
      workerCount: 7,
      workerHeapSampledCount: 6,
      workerHeapTotalBytes: 300 * MIB,
      workerHeapUsedBytes: 280 * MIB,
      workerExternalBytes: 10 * MIB,
      workerMemoryCoverage: 'partial',
      workerHeaps: [
        worker('sqlite-store.worker.js', 4, 40.4),
        worker('session-transcript.worker.js', 1, 60),
        worker('session-transcript.worker.js', 2, 59.6),
        worker('prepared-model-catalog.worker.js', 7, 12),
        worker('sqlite-store.worker.js', 5, 50),
        worker('session-transcript.worker.js', 3, 57),
      ],
    },
  };
}

function debugCaptures() {
  return postHogMocks.capture.mock.calls
    .map(([call]) => call)
    .filter((call) => call.event === 'TlonBot Harness Debug');
}

describe('memory sample telemetry', () => {
  beforeEach(() => {
    resetMemorySampleThrottleForTest();
    postHogMocks.identify.mockClear();
    postHogMocks.capture.mockClear();
    const telemetry = createTlonTelemetry({
      config: {
        enabled: true,
        apiKey: 'phc_test',
        host: 'https://us.i.posthog.com',
      },
    })!;
    setDebugTelemetryReporter((event) =>
      telemetry.captureHarnessDebug({
        ...event,
        accountId: event.accountId ?? 'default',
        ownerShip: event.ownerShip ?? '~zod',
        botShip: event.botShip || '~nec',
      })
    );
  });

  it('relays a full sample as one process-scoped harness debug event', () => {
    expect(reportMemorySampleDiagnostic(fullSample(), T0)).toBe(true);

    const captures = debugCaptures();
    expect(captures).toHaveLength(1);
    const { distinctId, properties } = captures[0];
    expect(distinctId).toBe('~zod');
    expect(properties).toMatchObject({
      harnessEventType: 'diagnostic.memory.sample',
      debugEventKind: 'diagnostic',
      accountId: 'default',
      ownerShip: '~zod',
      botShip: '~nec',
      message:
        `rssBytes=${1_500 * MIB} heapUsedBytes=${350 * MIB} ` +
        `heapTotalBytes=${400 * MIB} externalBytes=${20 * MIB} ` +
        `uptimeMs=3600000 workerCount=7 workerHeapSampledCount=6 ` +
        `workerHeapUsedBytes=${280 * MIB} workerHeapTotalBytes=${300 * MIB} ` +
        `workerExternalBytes=${10 * MIB} workerMemoryCoverage=partial`,
    });
    expect(properties.logAttributes).toEqual({
      rssBytes: 1_500 * MIB,
      heapUsedBytes: 350 * MIB,
      heapTotalBytes: 400 * MIB,
      externalBytes: 20 * MIB,
      uptimeMs: 3_600_000,
      workerCount: 7,
      workerHeapSampledCount: 6,
      workerHeapUsedBytes: 280 * MIB,
      workerHeapTotalBytes: 300 * MIB,
      workerExternalBytes: 10 * MIB,
      workerMemoryCoverage: 'partial',
      // 60 + 59.6 + 57 = 176.6 -> 177 used, 182.6 -> 183 total.
      workersByScript:
        'session-transcript.worker.js:3:177/183MiB;' +
        'sqlite-store.worker.js:2:90/94MiB;' +
        'prepared-model-catalog.worker.js:1:12/14MiB',
      topWorkers:
        'session-transcript.worker.js#1:60/62MiB;' +
        'session-transcript.worker.js#2:60/62MiB;' +
        'session-transcript.worker.js#3:57/59MiB;' +
        'sqlite-store.worker.js#5:50/52MiB;' +
        'sqlite-store.worker.js#4:40/42MiB',
    });
    expect(properties).not.toHaveProperty('sessionKey');
    expect(properties).not.toHaveProperty('destinationKind');
  });

  it('emits without worker fields when the sample has none', () => {
    expect(
      reportMemorySampleDiagnostic(
        {
          type: 'diagnostic.memory.sample',
          memory: { rssBytes: 900 * MIB, heapUsedBytes: 'not-a-number' },
        },
        T0
      )
    ).toBe(true);

    const captures = debugCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0].properties.logAttributes).toEqual({
      rssBytes: 900 * MIB,
    });
    expect(captures[0].properties.message).toBe(`rssBytes=${900 * MIB}`);
  });

  it('omits worker summaries for an empty workerHeaps list', () => {
    reportMemorySampleDiagnostic(
      {
        type: 'diagnostic.memory.sample',
        memory: { rssBytes: 1, workerHeaps: [], workerCount: 0 },
      },
      T0
    );

    const attributes = debugCaptures()[0].properties.logAttributes;
    expect(attributes).toEqual({ rssBytes: 1, workerCount: 0 });
  });

  it('drops samples within the throttle window', () => {
    expect(reportMemorySampleDiagnostic(fullSample(), T0)).toBe(true);
    expect(reportMemorySampleDiagnostic(fullSample(), T0 + 30_000)).toBe(false);
    expect(
      reportMemorySampleDiagnostic(
        fullSample(),
        T0 + MEMORY_SAMPLE_MIN_INTERVAL_MS - 1
      )
    ).toBe(false);
    expect(debugCaptures()).toHaveLength(1);

    expect(
      reportMemorySampleDiagnostic(
        fullSample(),
        T0 + MEMORY_SAMPLE_MIN_INTERVAL_MS
      )
    ).toBe(true);
    expect(debugCaptures()).toHaveLength(2);
  });

  it('does not let a backwards clock step suppress samples', () => {
    expect(reportMemorySampleDiagnostic(fullSample(), T0)).toBe(true);
    expect(reportMemorySampleDiagnostic(fullSample(), T0 - 60_000)).toBe(true);
    expect(debugCaptures()).toHaveLength(2);
  });

  it('ignores malformed payloads without consuming the throttle window', () => {
    for (const memory of [undefined, null, 'oops', 42, [1, 2]]) {
      expect(() =>
        reportMemorySampleDiagnostic(
          { type: 'diagnostic.memory.sample', memory },
          T0
        )
      ).not.toThrow();
    }
    expect(
      reportMemorySampleDiagnostic(
        {
          type: 'diagnostic.memory.sample',
          memory: {
            rssBytes: 1,
            workerHeaps: [null, 'x', { script: 7 }, { script: 'a.js' }],
          },
        },
        T0
      )
    ).toBe(true);

    const captures = debugCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0].properties.logAttributes).toEqual({ rssBytes: 1 });
  });
});
