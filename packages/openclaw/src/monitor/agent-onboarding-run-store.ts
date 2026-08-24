import { randomUUID } from 'node:crypto';

import type { PostBlobDataEntryAgentProvision } from '@tloncorp/api';
import type { PluginStateKeyedStore } from 'openclaw/plugin-sdk/plugin-state-runtime';

import { sharedMap, sharedSlot } from '../shared-state.js';

export type AgentOnboardingRunRecord = {
  provisionId: string;
  jobId: string;
  runId?: string;
  groupId: string;
  channelNest: string;
  notebookNest: string;
  notebookName: string;
  purposeId: string;
  topics: string[];
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

async function serializeWrite<T>(
  provisionId: string,
  write: () => Promise<T>
): Promise<T> {
  const previous = writeFlights.get(provisionId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  const barrier = current.then(
    () => undefined,
    () => undefined
  );
  writeFlights.set(provisionId, barrier);
  try {
    return await current;
  } finally {
    if (writeFlights.get(provisionId) === barrier) {
      writeFlights.delete(provisionId);
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

type CronJobWitness = {
  id: string;
  state?: { runningAtMs?: number; lastRunAtMs?: number };
};

export async function claimAgentOnboardingRun(
  initial: AgentOnboardingRunRecord,
  now: number,
  listJobs: () => Promise<CronJobWitness[]>
): Promise<
  | { outcome: 'enqueue' }
  | { outcome: 'owned-by-another-pass' }
  | { outcome: 'recovered'; record: AgentOnboardingRunRecord }
> {
  return serializeWrite(initial.provisionId, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      const existing = fallbackRecords.get(initial.provisionId);
      if (!existing) {
        fallbackRecords.set(initial.provisionId, initial);
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

    let ownsClaim = await store.registerIfAbsent(initial.provisionId, initial);
    if (ownsClaim) return { outcome: 'enqueue' } as const;

    const existing = await store.lookup(initial.provisionId);
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

    // A stale claim may represent a crash immediately before or after enqueue.
    // Cron state is the durable witness for the latter case.
    if (existing?.status === 'claimed') {
      const job = (await listJobs()).find(
        (candidate) => candidate.id === existing.jobId
      );
      if (
        (job?.state?.runningAtMs ?? 0) >= existing.claimedAt ||
        (job?.state?.lastRunAtMs ?? 0) >= existing.claimedAt
      ) {
        const recovered: AgentOnboardingRunRecord = {
          ...existing,
          status: 'enqueued',
          enqueuedAt: existing.claimedAt,
        };
        await store.register(initial.provisionId, recovered);
        return { outcome: 'recovered', record: recovered } as const;
      }
    }

    // Delete a stale, unwitnessed claim and elect exactly one recovery pass.
    await store.delete(initial.provisionId);
    ownsClaim = await store.registerIfAbsent(initial.provisionId, initial);
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
  await serializeWrite(initial.provisionId, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      fallbackRecords.set(initial.provisionId, {
        ...initial,
        runId,
        status: 'enqueued',
        enqueuedAt,
        outcome,
      });
      return;
    }
    const current = await store.lookup(initial.provisionId);
    if (current?.status === 'completed' || current?.status === 'failed') return;
    await store.register(initial.provisionId, {
      ...initial,
      runId,
      status: 'enqueued',
      enqueuedAt,
      outcome,
    });
  });
}

export function recordAgentOnboardingRunOutcome(
  runId: string,
  outcome: AgentOnboardingRunOutcome
): Promise<boolean> {
  const existing = outcomeFlights.get(runId);
  if (existing) return existing;
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
    ? (await store.entries()).find((entry) => entry.value.runId === runId)?.value
    : [...fallbackRecords.values()].find((record) => record.runId === runId);
  if (!stored) {
    pendingOutcomes.delete(runId);
    pendingOutcomes.set(runId, outcome);
    while (pendingOutcomes.size > MAX_PENDING_OUTCOMES) {
      const oldest = pendingOutcomes.keys().next().value;
      if (oldest === undefined) break;
      pendingOutcomes.delete(oldest);
    }
    return false;
  }
  await serializeWrite(stored.provisionId, async () => {
    const current =
      (await store?.lookup(stored.provisionId)) ??
      fallbackRecords.get(stored.provisionId);
    if (!current || current.runId !== runId || current.status !== 'enqueued') {
      return;
    }
    const updated = { ...current, outcome };
    if (store) await store.register(stored.provisionId, updated);
    else fallbackRecords.set(stored.provisionId, updated);
  });
  return true;
}

export async function lookupNewestAgentOnboardingRunForGroup(
  groupId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  const records = getAgentOnboardingRunStore()
    ? (await getAgentOnboardingRunStore()!.entries()).map(
        (entry) => entry.value
      )
    : [...fallbackRecords.values()];
  return records
    .filter((record) => record.groupId === groupId)
    .sort((a, b) => b.claimedAt - a.claimedAt)[0];
}

export async function forgetAgentOnboardingRunClaim(
  provisionId: string
): Promise<void> {
  fallbackRecords.delete(provisionId);
  await getAgentOnboardingRunStore()?.delete(provisionId);
}

export async function lookupAgentOnboardingRun(
  provisionId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return (
    (await getAgentOnboardingRunStore()?.lookup(provisionId)) ??
    fallbackRecords.get(provisionId)
  );
}

export async function markAgentOnboardingRunTerminal(
  provisionId: string,
  status: 'completed' | 'failed',
  completedAt = Date.now()
): Promise<void> {
  await serializeWrite(provisionId, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) {
      const record = fallbackRecords.get(provisionId);
      if (record) {
        fallbackRecords.set(provisionId, { ...record, status, completedAt });
      }
      return;
    }
    const record = await store.lookup(provisionId);
    if (!record) return;
    await store.register(provisionId, { ...record, status, completedAt });
  });
}

export function clearAgentOnboardingRunFallbackForTesting(): void {
  fallbackRecords.clear();
  pendingOutcomes.clear();
  outcomeFlights.clear();
}
