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
  claimedAt: number;
  enqueuedAt?: number;
  completedAt?: number;
  status: 'claimed' | 'enqueued' | 'completed' | 'failed';
};

export type AgentOnboardingRunStore =
  PluginStateKeyedStore<AgentOnboardingRunRecord>;

const CLAIM_GRACE_MS = 30_000;

const storeSlot = sharedSlot<AgentOnboardingRunStore>(
  'agentOnboarding.firstRunStore'
);
const writeFlights = sharedMap<string, Promise<void>>(
  'agentOnboarding.firstRunStoreWrites'
);

async function serializeWrite(
  provisionId: string,
  write: () => Promise<void>
): Promise<void> {
  const previous = writeFlights.get(provisionId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  writeFlights.set(provisionId, current);
  try {
    await current;
  } finally {
    if (writeFlights.get(provisionId) === current) {
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
  const store = getAgentOnboardingRunStore();
  if (!store) return { outcome: 'enqueue' };

  let ownsClaim = await store.registerIfAbsent(initial.provisionId, initial);
  if (ownsClaim) return { outcome: 'enqueue' };

  const existing = await store.lookup(initial.provisionId);
  if (
    existing?.status === 'enqueued' ||
    existing?.status === 'completed' ||
    existing?.status === 'failed'
  ) {
    return { outcome: 'recovered', record: existing };
  }
  if (
    existing?.status === 'claimed' &&
    now - existing.claimedAt < CLAIM_GRACE_MS
  ) {
    return { outcome: 'owned-by-another-pass' };
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
      return { outcome: 'recovered', record: recovered };
    }
  }

  // Delete a stale, unwitnessed claim and elect exactly one recovery pass.
  await store.delete(initial.provisionId);
  ownsClaim = await store.registerIfAbsent(initial.provisionId, initial);
  return ownsClaim
    ? { outcome: 'enqueue' }
    : { outcome: 'owned-by-another-pass' };
}

export async function recordAgentOnboardingRunEnqueued(
  initial: AgentOnboardingRunRecord,
  runId: string,
  enqueuedAt: number
): Promise<void> {
  await serializeWrite(initial.provisionId, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) return;
    const current = await store.lookup(initial.provisionId);
    if (current?.status === 'completed' || current?.status === 'failed') return;
    await store.register(initial.provisionId, {
      ...initial,
      runId,
      status: 'enqueued',
      enqueuedAt,
    });
  });
}

export async function forgetAgentOnboardingRunClaim(
  provisionId: string
): Promise<void> {
  await getAgentOnboardingRunStore()?.delete(provisionId);
}

export async function lookupAgentOnboardingRun(
  provisionId: string
): Promise<AgentOnboardingRunRecord | undefined> {
  return await getAgentOnboardingRunStore()?.lookup(provisionId);
}

export async function markAgentOnboardingRunTerminal(
  provisionId: string,
  status: 'completed' | 'failed',
  completedAt = Date.now()
): Promise<void> {
  await serializeWrite(provisionId, async () => {
    const store = getAgentOnboardingRunStore();
    if (!store) return;
    const record = await store.lookup(provisionId);
    if (!record) return;
    await store.register(provisionId, { ...record, status, completedAt });
  });
}
