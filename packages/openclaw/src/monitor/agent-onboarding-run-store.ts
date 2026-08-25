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
const pendingOutcomes = sharedMap<string, AgentOnboardingRunOutcome>(
  'agentOnboarding.pendingFirstRunOutcomes'
);
const outcomeFlights = sharedMap<string, Promise<boolean>>(
  'agentOnboarding.firstRunOutcomeFlights'
);
const MAX_PENDING_OUTCOMES = 64;

function runRecordKey(accountId: string, provisionId: string) {
  return `${accountId}\u0000${provisionId}`;
}

function keyForRecord(record: AgentOnboardingRunRecord) {
  return runRecordKey(record.accountId, record.provisionId);
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
  storeSlot.set(store);
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
  outcome: AgentOnboardingRunOutcome | undefined
): AgentOnboardingRunRecord {
  return {
    ...initial,
    runId,
    status: 'enqueued',
    enqueuedAt,
    ...(outcome ? { outcome: persistableOutcome(outcome) } : {}),
  };
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
  await outcomeFlights.get(runId);
  const outcome = pendingOutcomes.get(runId);
  pendingOutcomes.delete(runId);
  const recordKey = keyForRecord(initial);
  await serializeWrite(recordKey, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      const current = fallbackRecords.get(recordKey);
      if (
        current &&
        (current.status !== 'claimed' ||
          current.claimOwnerId !== initial.claimOwnerId ||
          current.claimedAt !== initial.claimedAt)
      ) {
        return;
      }
      fallbackRecords.set(
        recordKey,
        enqueuedRunRecord(initial, runId, enqueuedAt, outcome)
      );
      return;
    }
    const current = await store.lookup(recordKey);
    if (
      current?.status !== 'claimed' ||
      current.claimOwnerId !== initial.claimOwnerId ||
      current.claimedAt !== initial.claimedAt
    ) {
      return;
    }
    await store.register(
      recordKey,
      enqueuedRunRecord(initial, runId, enqueuedAt, outcome)
    );
  });
}

export function recordAgentOnboardingRunOutcome(
  runId: string,
  outcome: AgentOnboardingRunOutcome
): Promise<boolean> {
  const existing = outcomeFlights.get(runId);
  if (existing) {
    return existing.then(() => recordAgentOnboardingRunOutcome(runId, outcome));
  }
  const flight = recordAgentOnboardingRunOutcomeInternal(runId, outcome);
  outcomeFlights.set(runId, flight);
  void flight.then(
    () => {
      if (outcomeFlights.get(runId) === flight) outcomeFlights.delete(runId);
    },
    () => {
      if (outcomeFlights.get(runId) === flight) outcomeFlights.delete(runId);
    }
  );
  return flight;
}

async function recordAgentOnboardingRunOutcomeInternal(
  runId: string,
  outcome: AgentOnboardingRunOutcome
): Promise<boolean> {
  const store = getAgentOnboardingRunStore();
  const stored = store
    ? (await store.entries()).find((entry) => entry.value.runId === runId)
        ?.value
    : [...fallbackRecords.values()].find((record) => record.runId === runId);
  if (!stored) {
    const pending = pendingOutcomes.get(runId);
    pendingOutcomes.delete(runId);
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
    const current =
      (await store?.lookup(recordKey)) ?? fallbackRecords.get(recordKey);
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
    if (store) await store.register(recordKey, updated);
    else fallbackRecords.set(recordKey, updated);
  });
  return true;
}

export async function lookupNewestAgentOnboardingRunForGroup(
  accountId: string,
  groupId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  const records = getAgentOnboardingRunStore()
    ? (await getAgentOnboardingRunStore()!.entries()).map(
        (entry) => entry.value
      )
    : [...fallbackRecords.values()];
  return records
    .filter(
      (record) => record.accountId === accountId && record.groupId === groupId
    )
    .sort((a, b) => b.claimedAt - a.claimedAt)[0];
}

export async function lookupAgentOnboardingRunByJobId(
  jobId: string,
  accountId?: string
): Promise<AgentOnboardingRunRecord | undefined> {
  const records = getAgentOnboardingRunStore()
    ? (await getAgentOnboardingRunStore()!.entries()).map(
        (entry) => entry.value
      )
    : [...fallbackRecords.values()];
  return records
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
    const store = getAgentOnboardingRunStore();
    const current =
      (await store?.lookup(recordKey)) ?? fallbackRecords.get(recordKey);
    if (!current) return;
    const updated = { ...current, jobId, providerIds: [...providerIds] };
    if (store) await store.register(recordKey, updated);
    else fallbackRecords.set(recordKey, updated);
  });
}

export async function forgetAgentOnboardingRunClaim(
  initial: AgentOnboardingRunRecord
): Promise<void> {
  const recordKey = keyForRecord(initial);
  await serializeWrite(recordKey, async () => {
    const store = getAgentOnboardingRunStore();
    const current =
      (await store?.lookup(recordKey)) ?? fallbackRecords.get(recordKey);
    if (
      current?.status !== 'claimed' ||
      current.claimOwnerId !== initial.claimOwnerId ||
      current.claimedAt !== initial.claimedAt
    ) {
      return;
    }
    fallbackRecords.delete(recordKey);
    await store?.delete(recordKey);
  });
}

export async function lookupAgentOnboardingRun(
  accountId: string,
  provisionId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return (
    (await getAgentOnboardingRunStore()?.lookup(
      runRecordKey(accountId, provisionId)
    )) ?? fallbackRecords.get(runRecordKey(accountId, provisionId))
  );
}

export async function markAgentOnboardingRunTerminal(
  accountId: string,
  provisionId: string,
  status: 'completed' | 'failed',
  completedAt = Date.now()
): Promise<void> {
  const recordKey = runRecordKey(accountId, provisionId);
  await serializeWrite(recordKey, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      const record = fallbackRecords.get(recordKey);
      if (record) {
        fallbackRecords.set(recordKey, { ...record, status, completedAt });
      }
      return;
    }
    const record = await store.lookup(recordKey);
    if (!record) return;
    await store.register(recordKey, { ...record, status, completedAt });
  });
}

export function clearAgentOnboardingRunFallbackForTesting(): void {
  fallbackRecords.clear();
  pendingOutcomes.clear();
  outcomeFlights.clear();
}
