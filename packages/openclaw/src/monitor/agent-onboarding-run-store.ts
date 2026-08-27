import { randomUUID } from 'node:crypto';

import type { PostBlobDataEntryAgentProvision } from '@tloncorp/api';
import type { PluginStateKeyedStore } from 'openclaw/plugin-sdk/plugin-state-runtime';

import { sharedMap, sharedSlot } from '../shared-state.js';

export type AgentOnboardingRunRecord = {
  accountId: string;
  provisionId: string;
  jobId: string;
  runId?: string;
  groupId: string;
  channelNest: string;
  notebookNest: string;
  notebookName: string;
  purposeId: string;
  topics: string[];
  /** Hosting upstream IDs authorized for this job by the owner. */
  providerIds?: string[];
  /** Full durable request lets later provider changes rebuild the cron. */
  provision?: PostBlobDataEntryAgentProvision;
  claimedAt: number;
  /** Identifies the process that owns a fresh in-flight claim. */
  claimOwnerId?: string;
  enqueuedAt?: number;
  completedAt?: number;
  outcome?: AgentOnboardingRunOutcome;
  status: 'claimed' | 'enqueued' | 'completed' | 'failed';
};

export type AgentOnboardingRunOutcome = {
  status: 'ok' | 'error';
  delivered: boolean;
  /** Exact Notes entry produced by this run, when the delivery hook observed it. */
  noteId?: number;
  error?: string;
  observedAt: number;
};

export type AgentOnboardingRunStore =
  PluginStateKeyedStore<AgentOnboardingRunRecord>;

const CLAIM_GRACE_MS = 30_000;

const storeSlot = sharedSlot<AgentOnboardingRunStore>(
  'agentOnboarding.firstRunStore'
);
const claimOwnerSlot = sharedSlot<string>('agentOnboarding.claimOwnerId');
const claimOwnerId = claimOwnerSlot.get() ?? randomUUID();
claimOwnerSlot.set(claimOwnerId);
const writeFlights = sharedMap<string, Promise<void>>(
  'agentOnboarding.firstRunStoreWrites'
);
const fallbackRecords = sharedMap<string, AgentOnboardingRunRecord>(
  'agentOnboarding.firstRunFallbackRecords'
);
// A forced run can finish synchronously before enqueueRun returns its run ID.
// Keep that ordinary handoff, without a second flight registry for rarer
// concurrent store/enqueue interleavings.
const pendingOutcomes = sharedMap<string, AgentOnboardingRunOutcome>(
  'agentOnboarding.pendingFirstRunOutcomes'
);
const MAX_PENDING_OUTCOMES = 64;

function runRecordKey(accountId: string, provisionId: string) {
  return `${accountId}\u0000${provisionId}`;
}

function keyForRecord(record: AgentOnboardingRunRecord) {
  return runRecordKey(record.accountId, record.provisionId);
}

function persistableRunRecord(
  record: AgentOnboardingRunRecord
): AgentOnboardingRunRecord {
  // OpenClaw validates plugin state before encoding it and rejects `undefined`
  // even though JSON normally omits undefined object properties. Normalize all
  // records at this boundary so every durable write follows JSON semantics.
  return JSON.parse(JSON.stringify(record)) as AgentOnboardingRunRecord;
}

function persistableRunStore(
  store: AgentOnboardingRunStore
): AgentOnboardingRunStore {
  return {
    register: (key, value, options) =>
      store.register(key, persistableRunRecord(value), options),
    registerIfAbsent: (key, value, options) =>
      store.registerIfAbsent(key, persistableRunRecord(value), options),
    lookup: (key) => store.lookup(key),
    consume: (key) => store.consume(key),
    delete: (key) => store.delete(key),
    entries: () => store.entries(),
    clear: () => store.clear(),
  };
}

async function serializeWrite<T>(
  recordKey: string,
  write: () => Promise<T>
): Promise<T> {
  const previous = writeFlights.get(recordKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  const barrier = current.then(
    () => undefined,
    () => undefined
  );
  writeFlights.set(recordKey, barrier);
  try {
    return await current;
  } finally {
    if (writeFlights.get(recordKey) === barrier) {
      writeFlights.delete(recordKey);
    }
  }
}

export function setAgentOnboardingRunStore(
  store: AgentOnboardingRunStore | null
): void {
  storeSlot.set(store ? persistableRunStore(store) : null);
}

export function getAgentOnboardingRunStore(): AgentOnboardingRunStore | null {
  return storeSlot.get();
}

export function getAgentOnboardingClaimOwnerId(): string {
  return claimOwnerId;
}

function persistableOutcome(
  outcome: AgentOnboardingRunOutcome
): AgentOnboardingRunOutcome {
  return {
    status: outcome.status,
    delivered: outcome.delivered,
    observedAt: outcome.observedAt,
    ...(outcome.noteId !== undefined ? { noteId: outcome.noteId } : {}),
    ...(outcome.error !== undefined ? { error: outcome.error } : {}),
  };
}

function enqueuedRunRecord(
  initial: AgentOnboardingRunRecord,
  runId: string,
  enqueuedAt: number,
  outcome?: AgentOnboardingRunOutcome
): AgentOnboardingRunRecord {
  return {
    ...initial,
    runId,
    status: 'enqueued',
    enqueuedAt,
    ...(outcome ? { outcome: persistableOutcome(outcome) } : {}),
  };
}

async function allRunRecords(): Promise<AgentOnboardingRunRecord[]> {
  const store = getAgentOnboardingRunStore();
  return store
    ? (await store.entries()).map((entry) => entry.value)
    : [...fallbackRecords.values()];
}

async function currentRunRecord(
  recordKey: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return (
    (await getAgentOnboardingRunStore()?.lookup(recordKey)) ??
    fallbackRecords.get(recordKey)
  );
}

async function writeRunRecord(
  recordKey: string,
  record: AgentOnboardingRunRecord
): Promise<void> {
  const store = getAgentOnboardingRunStore();
  if (store) await store.register(recordKey, record);
  else fallbackRecords.set(recordKey, record);
}

export async function claimAgentOnboardingRun(
  initial: AgentOnboardingRunRecord,
  now: number
): Promise<
  | { outcome: 'enqueue' }
  | { outcome: 'owned-by-another-pass' }
  | { outcome: 'recovered'; record: AgentOnboardingRunRecord }
> {
  const recordKey = keyForRecord(initial);
  return serializeWrite(recordKey, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      const existing = fallbackRecords.get(recordKey);
      if (!existing) {
        fallbackRecords.set(recordKey, initial);
        return { outcome: 'enqueue' } as const;
      }
      if (
        existing.status === 'enqueued' ||
        existing.status === 'completed' ||
        existing.status === 'failed'
      ) {
        return { outcome: 'recovered', record: existing } as const;
      }
      return { outcome: 'owned-by-another-pass' } as const;
    }

    let ownsClaim = await store.registerIfAbsent(recordKey, initial);
    if (ownsClaim) return { outcome: 'enqueue' } as const;

    const existing = await store.lookup(recordKey);
    if (
      existing?.status === 'enqueued' ||
      existing?.status === 'completed' ||
      existing?.status === 'failed'
    ) {
      return { outcome: 'recovered', record: existing } as const;
    }
    if (
      existing?.status === 'claimed' &&
      existing.claimOwnerId === initial.claimOwnerId &&
      now - existing.claimedAt < CLAIM_GRACE_MS
    ) {
      return { outcome: 'owned-by-another-pass' } as const;
    }

    // Aggregate cron timestamps cannot identify the accepted run. Re-enqueue
    // under a fresh exact run ID rather than persisting an uncorrelatable
    // record that can never receive its terminal outcome.
    await store.delete(recordKey);
    ownsClaim = await store.registerIfAbsent(recordKey, initial);
    return ownsClaim
      ? ({ outcome: 'enqueue' } as const)
      : ({ outcome: 'owned-by-another-pass' } as const);
  });
}

export async function recordAgentOnboardingRunEnqueued(
  initial: AgentOnboardingRunRecord,
  runId: string,
  enqueuedAt: number
): Promise<void> {
  const outcome = pendingOutcomes.get(runId);
  pendingOutcomes.delete(runId);
  const recordKey = keyForRecord(initial);
  await serializeWrite(recordKey, async () => {
    const current = await currentRunRecord(recordKey);
    if (current?.status !== 'claimed') return;
    await writeRunRecord(
      recordKey,
      enqueuedRunRecord(initial, runId, enqueuedAt, outcome)
    );
  });
}

export async function recordAgentOnboardingRunOutcome(
  runId: string,
  outcome: AgentOnboardingRunOutcome
): Promise<boolean> {
  const stored = (await allRunRecords()).find(
    (record) => record.runId === runId
  );
  if (!stored) {
    const pending = pendingOutcomes.get(runId);
    const noteId = outcome.delivered
      ? (outcome.noteId ?? pending?.noteId)
      : undefined;
    pendingOutcomes.set(
      runId,
      persistableOutcome({
        ...outcome,
        ...(noteId !== undefined ? { noteId } : {}),
      })
    );
    while (pendingOutcomes.size > MAX_PENDING_OUTCOMES) {
      const oldest = pendingOutcomes.keys().next().value;
      if (oldest === undefined) break;
      pendingOutcomes.delete(oldest);
    }
    return false;
  }
  const recordKey = keyForRecord(stored);
  await serializeWrite(recordKey, async () => {
    const current = await currentRunRecord(recordKey);
    if (!current || current.runId !== runId || current.status !== 'enqueued') {
      return;
    }
    const noteId = outcome.delivered
      ? (outcome.noteId ?? current.outcome?.noteId)
      : undefined;
    const updated = {
      ...current,
      outcome: persistableOutcome({
        ...outcome,
        ...(noteId !== undefined ? { noteId } : {}),
      }),
    };
    await writeRunRecord(recordKey, updated);
  });
  return true;
}

export async function lookupNewestAgentOnboardingRunForGroup(
  accountId: string,
  groupId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return (await allRunRecords())
    .filter(
      (record) => record.accountId === accountId && record.groupId === groupId
    )
    .sort((a, b) => b.claimedAt - a.claimedAt)[0];
}

export async function lookupAgentOnboardingRunByJobId(
  jobId: string,
  accountId?: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return (await allRunRecords())
    .filter(
      (record) =>
        record.jobId === jobId &&
        (accountId === undefined || record.accountId === accountId)
    )
    .sort((left, right) => right.claimedAt - left.claimedAt)[0];
}

export async function updateAgentOnboardingRunProviders(
  accountId: string,
  provisionId: string,
  jobId: string,
  providerIds: readonly string[]
): Promise<void> {
  const recordKey = runRecordKey(accountId, provisionId);
  await serializeWrite(recordKey, async () => {
    const current = await currentRunRecord(recordKey);
    if (!current) return;
    await writeRunRecord(recordKey, {
      ...current,
      jobId,
      providerIds: [...providerIds],
    });
  });
}

export async function forgetAgentOnboardingRunClaim(
  initial: AgentOnboardingRunRecord
): Promise<void> {
  const recordKey = keyForRecord(initial);
  await serializeWrite(recordKey, async () => {
    const store = getAgentOnboardingRunStore();
    const current = await currentRunRecord(recordKey);
    if (current?.status !== 'claimed') return;
    fallbackRecords.delete(recordKey);
    await store?.delete(recordKey);
  });
}

export async function lookupAgentOnboardingRun(
  accountId: string,
  provisionId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return currentRunRecord(runRecordKey(accountId, provisionId));
}

export async function markAgentOnboardingRunTerminal(
  accountId: string,
  provisionId: string,
  status: 'completed' | 'failed',
  completedAt = Date.now()
): Promise<void> {
  const recordKey = runRecordKey(accountId, provisionId);
  await serializeWrite(recordKey, async () => {
    const record = await currentRunRecord(recordKey);
    if (!record) return;
    await writeRunRecord(recordKey, { ...record, status, completedAt });
  });
}

export function clearAgentOnboardingRunFallbackForTesting(): void {
  fallbackRecords.clear();
  pendingOutcomes.clear();
}
