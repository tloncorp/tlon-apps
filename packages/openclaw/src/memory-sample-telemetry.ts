import { diagnosticSummary } from './diagnostic-summary.js';
import { sharedSlot } from './shared-state.js';
import {
  reportProcessHarnessDebug,
  type TlonDiagnosticLogAttributes,
} from './telemetry.js';

// OpenClaw emits `diagnostic.memory.sample` every 30s while the bot is
// active; one event per 2 minutes caps volume at 720 events/day/bot.
export const MEMORY_SAMPLE_MIN_INTERVAL_MS = 120_000;

const MEMORY_SAMPLE_EVENT_TYPE = 'diagnostic.memory.sample';
const TOP_WORKER_COUNT = 5;
const BYTES_PER_MIB = 1024 * 1024;

// Shared across plugin module contexts so the cap is per process.
const lastEmittedAtSlot = sharedSlot<number>(
  'telemetry.memorySample.lastEmittedAt'
);

type WorkerHeap = {
  script: string;
  threadId: number | null;
  heapUsed: number;
  heapTotal: number;
};

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toMiB(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MIB);
}

// Scripts are joined into `;`/`:`/`#`-delimited summaries, so keep those
// delimiters out of the name.
function sanitizeScript(script: string): string {
  return script.replace(/[;:#\s]/g, '_').slice(0, 80);
}

function readWorkerHeaps(value: unknown): WorkerHeap[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const heaps: WorkerHeap[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const script =
      typeof record.script === 'string' && record.script.trim()
        ? sanitizeScript(record.script.trim())
        : null;
    const heapUsed = finiteNumber(record.heapUsed);
    if (!script || heapUsed === null) {
      continue;
    }
    heaps.push({
      script,
      threadId: finiteNumber(record.threadId),
      heapUsed,
      heapTotal: finiteNumber(record.heapTotal) ?? 0,
    });
  }
  return heaps;
}

/** `script:count:usedMiB/totalMiB` per script, heaviest first. */
function summarizeWorkersByScript(heaps: WorkerHeap[]): string | null {
  const byScript = new Map<
    string,
    { count: number; heapUsed: number; heapTotal: number }
  >();
  for (const heap of heaps) {
    const totals = byScript.get(heap.script) ?? {
      count: 0,
      heapUsed: 0,
      heapTotal: 0,
    };
    totals.count += 1;
    totals.heapUsed += heap.heapUsed;
    totals.heapTotal += heap.heapTotal;
    byScript.set(heap.script, totals);
  }
  if (byScript.size === 0) {
    return null;
  }
  return [...byScript.entries()]
    .sort(
      ([scriptA, a], [scriptB, b]) =>
        b.heapUsed - a.heapUsed || scriptA.localeCompare(scriptB)
    )
    .map(
      ([script, totals]) =>
        `${script}:${totals.count}:${toMiB(totals.heapUsed)}/${toMiB(totals.heapTotal)}MiB`
    )
    .join(';');
}

/** `script#threadId:usedMiB/totalMiB` for the heaviest individual workers. */
function summarizeTopWorkers(heaps: WorkerHeap[]): string | null {
  if (heaps.length === 0) {
    return null;
  }
  return [...heaps]
    .sort((a, b) => b.heapUsed - a.heapUsed)
    .slice(0, TOP_WORKER_COUNT)
    .map(
      (heap) =>
        `${heap.script}#${heap.threadId ?? '?'}:${toMiB(heap.heapUsed)}/${toMiB(heap.heapTotal)}MiB`
    )
    .join(';');
}

/**
 * Relays a throttled `diagnostic.memory.sample` as a process-scoped
 * `TlonBot Harness Debug` event. Throttled samples are dropped, not queued.
 * Returns whether an event was reported.
 */
export function reportMemorySampleDiagnostic(
  event: Record<string, unknown>,
  now: number = Date.now()
): boolean {
  const memory = event.memory;
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)) {
    return false;
  }

  const lastEmittedAt = lastEmittedAtSlot.get();
  if (lastEmittedAt !== null) {
    const elapsed = now - lastEmittedAt;
    // A backwards clock step must not suppress samples indefinitely.
    if (elapsed >= 0 && elapsed < MEMORY_SAMPLE_MIN_INTERVAL_MS) {
      return false;
    }
  }
  lastEmittedAtSlot.set(now);

  const record = memory as Record<string, unknown>;
  const heaps = readWorkerHeaps(record.workerHeaps);
  const coverage =
    typeof record.workerMemoryCoverage === 'string' &&
    record.workerMemoryCoverage.trim()
      ? record.workerMemoryCoverage.trim().slice(0, 32)
      : null;
  const numbers: Array<[string, number | null]> = [
    ['rssBytes', finiteNumber(record.rssBytes)],
    ['heapUsedBytes', finiteNumber(record.heapUsedBytes)],
    ['heapTotalBytes', finiteNumber(record.heapTotalBytes)],
    ['externalBytes', finiteNumber(record.externalBytes)],
    ['uptimeMs', finiteNumber(event.uptimeMs)],
    ['workerCount', finiteNumber(record.workerCount)],
    ['workerHeapSampledCount', finiteNumber(record.workerHeapSampledCount)],
    ['workerHeapUsedBytes', finiteNumber(record.workerHeapUsedBytes)],
    ['workerHeapTotalBytes', finiteNumber(record.workerHeapTotalBytes)],
    ['workerExternalBytes', finiteNumber(record.workerExternalBytes)],
  ];
  const workersByScript = summarizeWorkersByScript(heaps);
  const topWorkers = summarizeTopWorkers(heaps);

  const attributes: TlonDiagnosticLogAttributes = {};
  for (const [key, value] of numbers) {
    if (value !== null) {
      attributes[key] = value;
    }
  }
  if (coverage) {
    attributes.workerMemoryCoverage = coverage;
  }
  if (workersByScript) {
    attributes.workersByScript = workersByScript;
  }
  if (topWorkers) {
    attributes.topWorkers = topWorkers;
  }

  reportProcessHarnessDebug({
    harnessEventType: MEMORY_SAMPLE_EVENT_TYPE,
    debugEventKind: 'diagnostic',
    message: diagnosticSummary([
      ...numbers,
      ['workerMemoryCoverage', coverage],
    ]),
    logAttributes: attributes,
  });
  return true;
}

export function resetMemorySampleThrottleForTest(): void {
  lastEmittedAtSlot.set(null);
}
