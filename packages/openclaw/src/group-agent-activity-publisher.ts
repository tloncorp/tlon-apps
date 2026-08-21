import {
  type ParticipantAgentActivityProjectionV1,
  ParticipantAgentActivityProjectionV1Schema,
} from '@tloncorp/api/client/participantAgentActivity';
import type { RuntimeEnv } from 'openclaw/plugin-sdk/runtime';

import { isContextLensCardEligible } from './context-lens-card-eligibility.js';
import type { ContextLensEvent } from './context-lens-events.js';
import type { ContextLens } from './context-lens.js';
import type {
  GroupAgentActivityPost,
  GroupAgentActivityPostDraft,
  GroupAgentActivityTransport,
} from './group-agent-activity-transport.js';
import { participantAgentDeliveryParentId } from './participant-agent-activity.js';
import type { BotProfile } from './urbit/send.js';
import type { Story } from './urbit/story.js';

type ProjectOutcome = 'completed' | 'failed' | 'cancelled';

type ProjectOptions = {
  surface: ParticipantAgentActivityProjectionV1['surface'];
  finalReplyDelivered: boolean;
  revision: number;
  outcome?: ProjectOutcome;
};

type FinalPost = {
  post: GroupAgentActivityPost | null;
  sentAt: number;
  draft: GroupAgentActivityPostDraft;
  baseBlob: string;
  initialProjection: ParticipantAgentActivityProjectionV1;
  outcome: 'completed' | 'failed';
};

type RunState = {
  lensId: string;
  latestLens: ContextLens | null;
  carrier: GroupAgentActivityPost | null;
  carrierProjection: ParticipantAgentActivityProjectionV1 | null;
  carrierSemantic: string | null;
  finalPost: FinalPost | null;
  finalProjection: ParticipantAgentActivityProjectionV1 | null;
  finalSemantic: string | null;
  preparedFinalProjection: ParticipantAgentActivityProjectionV1 | null;
  lastPublishedAt: number;
  lastPublicUpdatedAt: number;
  scheduled: boolean;
  dirty: boolean;
  heartbeatDue: boolean;
  forcedOutcome: ProjectOutcome | null;
  timer: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  evictionTimer: ReturnType<typeof setTimeout> | null;
  retryAttempt: number;
  chain: Promise<void>;
  revision: number;
  inputVersion: number;
  publishing: boolean;
  tombstoneUntil: number;
};

const TERMINAL_STATUSES = new Set<ContextLens['status']>([
  'completed',
  'no_reply',
  'timed_out',
  'aborted',
  'error',
]);

const TERMINAL_PUBLIC_STATES = new Set<
  ParticipantAgentActivityProjectionV1['state']
>(['completed', 'incomplete', 'failed', 'timed_out', 'cancelled']);

const DEFAULT_MIN_UPDATE_INTERVAL_MS = 1_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60_000;
const DEFAULT_RETENTION_MS = 5 * 60_000;
const DEFAULT_TOMBSTONE_MS = 30 * 60_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 30_000, 60_000];

function isGroupConversationLens(lens: ContextLens) {
  const conversationId = lens.triggerDetails.conversationId?.trim();
  return (
    lens.chatType === 'channel' &&
    lens.runKind === 'conversation' &&
    Boolean(conversationId && /^chat\/~[^/]+\/[^/]+$/.test(conversationId))
  );
}

function carrierFallback(state: ParticipantAgentActivityProjectionV1['state']) {
  switch (state) {
    case 'waiting_owner':
      return 'Waiting for approval…';
    case 'waiting_requester':
      return 'Waiting for a response…';
    case 'completed':
      return 'Finished.';
    case 'incomplete':
      return 'Finished with incomplete steps.';
    case 'failed':
      return 'The agent run failed.';
    case 'timed_out':
      return 'The agent run timed out.';
    case 'cancelled':
      return 'The agent run was cancelled.';
    case 'working':
      return 'Working…';
  }
}

function semanticProjection(projection: ParticipantAgentActivityProjectionV1) {
  // Normalize through the wire schema before stringifying. Callers can build
  // structurally identical objects with different insertion order; comparing
  // their raw JSON would treat that as public activity churn and edit the
  // carrier/final post unnecessarily.
  const normalized =
    ParticipantAgentActivityProjectionV1Schema.parse(projection);
  const semantic: Partial<ParticipantAgentActivityProjectionV1> = {
    ...normalized,
  };
  delete semantic.revision;
  delete semantic.updatedAt;
  delete semantic.completedAt;
  return JSON.stringify(semantic);
}

function isTerminalProjection(
  projection: ParticipantAgentActivityProjectionV1
) {
  return TERMINAL_PUBLIC_STATES.has(projection.state);
}

/**
 * Publishes only an allowlisted projection through ordinary channel posts.
 * The channel host therefore remains the authorization boundary; raw Context
 * Lens snapshots continue to flow solely to the owner's %steward store.
 */
export function createGroupAgentActivityPublisher(options: {
  transport: GroupAgentActivityTransport;
  runtime?: RuntimeEnv;
  botShip: string;
  getBotProfile: () => BotProfile | undefined;
  project: (
    lens: ContextLens,
    options: ProjectOptions
  ) => ParticipantAgentActivityProjectionV1 | null;
  serializeReferenceBlob: (params: {
    lensId: string;
    botShip: string;
    delivery: 'final' | 'intermediate';
    outcome?: 'completed' | 'failed';
    participantActivity: ParticipantAgentActivityProjectionV1;
  }) => string;
  replaceParticipantActivity: (
    blob: string,
    lensId: string,
    participantActivity: ParticipantAgentActivityProjectionV1
  ) => string;
  storyFromText: (text: string) => Story;
  minUpdateIntervalMs?: number;
  heartbeatIntervalMs?: number;
  retryDelaysMs?: readonly number[];
  retentionMs?: number;
}) {
  const states = new Map<string, RunState>();
  const tombstones = new Map<string, number>();
  const minUpdateIntervalMs = Math.max(
    0,
    options.minUpdateIntervalMs ?? DEFAULT_MIN_UPDATE_INTERVAL_MS
  );
  const heartbeatIntervalMs = Math.max(
    1_000,
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  );
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const retentionMs = Math.max(
    1_000,
    options.retentionMs ?? DEFAULT_RETENTION_MS
  );
  let stopping = false;
  let stopped = false;
  let stopPromise: Promise<void> | null = null;
  let tombstoneSweepTimer: ReturnType<typeof setTimeout> | null = null;

  const reportError = (lensId: string, action: string, error: unknown) => {
    options.runtime?.error?.(
      `[tlon] Participant agent activity ${action} failed for ${lensId}: ${
        error instanceof Error ? error.stack ?? error.message : String(error)
      }`
    );
  };

  const clearTimer = (
    state: RunState,
    key: 'timer' | 'heartbeatTimer' | 'retryTimer' | 'evictionTimer'
  ) => {
    const timer = state[key];
    if (timer) {
      clearTimeout(timer);
      state[key] = null;
    }
  };

  const getDraft = (
    lens: ContextLens,
    projection: ParticipantAgentActivityProjectionV1
  ): GroupAgentActivityPostDraft | null => {
    const conversationId = lens.triggerDetails.conversationId?.trim();
    if (!conversationId) {
      return null;
    }
    const parentId = participantAgentDeliveryParentId(lens);
    return {
      conversationId,
      authorId: options.botShip,
      ...(parentId ? { parentId } : {}),
      story: options.storyFromText(carrierFallback(projection.state)),
      blob: options.serializeReferenceBlob({
        lensId: lens.lensId,
        botShip: options.botShip,
        delivery: 'intermediate',
        participantActivity: projection,
      }),
      participantActivity: projection,
      botProfile: options.getBotProfile(),
    };
  };

  const ensureState = (lens: ContextLens) => {
    let state = states.get(lens.lensId);
    if (!state) {
      state = {
        lensId: lens.lensId,
        latestLens: lens,
        carrier: null,
        carrierProjection: null,
        carrierSemantic: null,
        finalPost: null,
        finalProjection: null,
        finalSemantic: null,
        preparedFinalProjection: null,
        lastPublishedAt: 0,
        lastPublicUpdatedAt: 0,
        scheduled: false,
        dirty: false,
        heartbeatDue: false,
        forcedOutcome: null,
        timer: null,
        heartbeatTimer: null,
        retryTimer: null,
        evictionTimer: null,
        retryAttempt: 0,
        chain: Promise.resolve(),
        revision: 0,
        inputVersion: 0,
        publishing: false,
        tombstoneUntil: 0,
      };
      states.set(lens.lensId, state);
    }
    if (!state.latestLens) {
      // A new event after bounded retry exhaustion starts a fresh delivery
      // cycle instead of inheriting the exhausted attempt counter.
      state.retryAttempt = 0;
    }
    state.latestLens = lens;
    state.inputVersion += 1;
    clearTimer(state, 'evictionTimer');
    return state;
  };

  const projectCandidate = (
    state: RunState,
    lens: ContextLens,
    surface: ParticipantAgentActivityProjectionV1['surface'],
    outcome?: ProjectOutcome
  ) => {
    return options.project(lens, {
      surface,
      finalReplyDelivered: Boolean(state.finalPost),
      revision: state.revision + 1,
      ...(outcome ? { outcome } : {}),
    });
  };

  const materializeProjection = (
    state: RunState,
    candidate: ParticipantAgentActivityProjectionV1,
    forceTimestamp = false
  ) => {
    state.revision += 1;
    const updatedAt = Math.max(
      candidate.createdAt,
      Date.now(),
      state.lastPublicUpdatedAt + 1
    );
    state.lastPublicUpdatedAt = updatedAt;
    const materialized: ParticipantAgentActivityProjectionV1 = {
      ...candidate,
      revision: state.revision,
      updatedAt,
      ...(isTerminalProjection(candidate) ? { completedAt: updatedAt } : {}),
    };
    if (!isTerminalProjection(candidate) && materialized.completedAt) {
      delete materialized.completedAt;
    }
    // `forceTimestamp` documents that a liveness-only heartbeat is an
    // intentional public revision even when its semantic content is stable.
    void forceTimestamp;
    return ParticipantAgentActivityProjectionV1Schema.parse(materialized);
  };

  const scheduleTombstoneSweep = () => {
    if (tombstoneSweepTimer) {
      clearTimeout(tombstoneSweepTimer);
      tombstoneSweepTimer = null;
    }
    if (stopping || tombstones.size === 0) {
      return;
    }
    const now = Date.now();
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const expiresAt of tombstones.values()) {
      nextExpiry = Math.min(nextExpiry, expiresAt);
    }
    tombstoneSweepTimer = setTimeout(
      () => {
        tombstoneSweepTimer = null;
        const sweepAt = Date.now();
        for (const [lensId, expiresAt] of tombstones) {
          if (expiresAt <= sweepAt) {
            tombstones.delete(lensId);
          }
        }
        scheduleTombstoneSweep();
      },
      Math.max(0, nextExpiry - now)
    );
  };

  const scheduleEviction = (state: RunState) => {
    clearTimer(state, 'evictionTimer');
    state.evictionTimer = setTimeout(() => {
      state.evictionTimer = null;
      if (
        !state.latestLens &&
        !state.scheduled &&
        !state.retryTimer &&
        states.get(state.lensId) === state
      ) {
        if (state.tombstoneUntil > Date.now()) {
          tombstones.set(state.lensId, state.tombstoneUntil);
          scheduleTombstoneSweep();
        }
        states.delete(state.lensId);
      }
    }, retentionMs);
  };

  const releasePrivateState = (state: RunState) => {
    if (state.carrier || state.finalPost) {
      const now = Date.now();
      const lensExpiry = state.latestLens?.expiresAt;
      state.tombstoneUntil = Math.max(
        state.tombstoneUntil,
        now + DEFAULT_TOMBSTONE_MS,
        typeof lensExpiry === 'number' && Number.isFinite(lensExpiry)
          ? lensExpiry
          : 0
      );
    }
    state.latestLens = null;
    state.forcedOutcome = null;
    state.heartbeatDue = false;
    clearTimer(state, 'heartbeatTimer');
    scheduleEviction(state);
  };

  const scheduleHeartbeat = (state: RunState) => {
    clearTimer(state, 'heartbeatTimer');
    if (
      stopping ||
      !state.latestLens ||
      state.finalPost ||
      TERMINAL_STATUSES.has(state.latestLens.status)
    ) {
      return;
    }
    state.heartbeatTimer = setTimeout(() => {
      state.heartbeatTimer = null;
      state.heartbeatDue = true;
      state.dirty = true;
      if (!state.publishing) {
        enqueue(state);
      }
    }, heartbeatIntervalMs);
  };

  const publishCarrier = async (
    state: RunState,
    lens: ContextLens,
    outcome?: ProjectOutcome
  ) => {
    // Once the normal final reply exists, an absent carrier must stay absent.
    // Creating a terminal fallback after the final reply would produce an
    // out-of-order unread post for clients that do not understand the blob.
    // Shutdown likewise only terminalizes carriers that were already sent.
    if (!state.carrier && (state.finalPost || stopping)) {
      return;
    }
    const candidate = projectCandidate(state, lens, 'carrier', outcome);
    if (!candidate) {
      return;
    }
    const candidateSemantic = semanticProjection(candidate);
    const forceHeartbeat =
      state.heartbeatDue && !isTerminalProjection(candidate);
    if (
      state.carrier &&
      candidateSemantic === state.carrierSemantic &&
      !forceHeartbeat
    ) {
      scheduleHeartbeat(state);
      return;
    }
    const projection = materializeProjection(state, candidate, forceHeartbeat);
    const draft = getDraft(lens, projection);
    if (!draft) {
      return;
    }
    if (!state.carrier) {
      state.carrier = await options.transport.create(draft);
    } else {
      await options.transport.update(state.carrier, draft);
    }
    state.carrierProjection = projection;
    state.carrierSemantic = candidateSemantic;
    state.heartbeatDue = false;
    state.lastPublishedAt = Date.now();
    scheduleHeartbeat(state);
  };

  const publishFinal = async (state: RunState, lens: ContextLens) => {
    const finalPost = state.finalPost;
    if (!finalPost) {
      return;
    }
    const candidate = projectCandidate(state, lens, 'final', finalPost.outcome);
    if (!candidate) {
      return;
    }
    const candidateSemantic = semanticProjection(candidate);
    if (candidateSemantic === state.finalSemantic) {
      return;
    }
    const projection = materializeProjection(state, candidate);
    if (!finalPost.post) {
      finalPost.post = await options.transport.resolve(
        finalPost.sentAt,
        finalPost.draft
      );
    }
    const blob = options.replaceParticipantActivity(
      finalPost.baseBlob,
      state.lensId,
      projection
    );
    await options.transport.update(finalPost.post, {
      ...finalPost.draft,
      blob,
      participantActivity: projection,
    });
    state.finalProjection = projection;
    state.finalSemantic = candidateSemantic;
    state.lastPublishedAt = Date.now();
  };

  const runPublish = async (state: RunState) => {
    const lens = state.latestLens;
    if (!lens) {
      state.dirty = false;
      return;
    }
    const inputVersion = state.inputVersion;
    const terminalLens = TERMINAL_STATUSES.has(lens.status);
    const carrierOutcome =
      state.forcedOutcome ?? state.finalPost?.outcome ?? undefined;

    // Carrier and final receipts are independent public surfaces. A deleted or
    // temporarily uneditable carrier must never block reconciliation of the
    // normal final reply.
    let publishError: unknown;
    try {
      await publishCarrier(state, lens, carrierOutcome);
    } catch (error) {
      publishError = error;
    }
    if (state.finalPost) {
      try {
        await publishFinal(state, lens);
      } catch (error) {
        publishError ??= error;
      }
    }
    if (publishError) {
      throw publishError;
    }

    // A Lens event may arrive while host create/edit confirmation is pending.
    // Never let an older successful publish clear that newer private snapshot.
    if (state.inputVersion !== inputVersion) {
      state.dirty = true;
      state.retryAttempt = 0;
      clearTimer(state, 'retryTimer');
      if (!state.timer) {
        enqueue(state);
      }
      return;
    }
    state.dirty = false;
    state.retryAttempt = 0;
    clearTimer(state, 'retryTimer');
    if (terminalLens || state.finalPost || state.forcedOutcome) {
      releasePrivateState(state);
    }
  };

  const scheduleRetry = (state: RunState) => {
    if (stopping || state.retryTimer) {
      return;
    }
    const delayMs = retryDelaysMs[state.retryAttempt];
    if (delayMs === undefined) {
      // Bounded retries must also bound retention of the full owner-only Lens
      // snapshot. A later event can revive the retained public handles during
      // the short eviction window, or start a fresh state after eviction.
      state.dirty = false;
      releasePrivateState(state);
      return;
    }
    state.retryAttempt += 1;
    state.retryTimer = setTimeout(
      () => {
        state.retryTimer = null;
        enqueue(state);
      },
      Math.max(0, delayMs)
    );
  };

  const enqueue = (state: RunState) => {
    if (stopped || state.scheduled) {
      return;
    }
    state.scheduled = true;
    queueMicrotask(() => {
      state.scheduled = false;
      state.chain = state.chain
        .then(async () => {
          state.publishing = true;
          try {
            await runPublish(state);
          } finally {
            state.publishing = false;
          }
        })
        .catch((error) => {
          reportError(state.lensId, 'publish', error);
          state.dirty = true;
          scheduleRetry(state);
        });
    });
  };

  const schedule = (state: RunState, immediate: boolean) => {
    clearTimer(state, 'timer');
    const delayMs = immediate
      ? 0
      : Math.max(0, state.lastPublishedAt + minUpdateIntervalMs - Date.now());
    if (delayMs === 0) {
      enqueue(state);
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      enqueue(state);
    }, delayMs);
  };

  const drainQueuedWork = async () => {
    for (const state of states.values()) {
      if (state.dirty) {
        enqueue(state);
      }
    }

    // Work can append another chain link when it notices that an input arrived
    // during an awaited host confirmation. Drain until that chain is stable.
    let stable = false;
    while (!stable) {
      await Promise.resolve();
      const entries = [...states.values()];
      const chains = entries.map((state) => state.chain);
      await Promise.all(chains);
      await Promise.resolve();
      stable = entries.every(
        (state, index) =>
          state.chain === chains[index] && state.scheduled === false
      );
    }
  };

  const hasLiveTombstone = (lensId: string) => {
    const expiresAt = tombstones.get(lensId);
    if (expiresAt === undefined) {
      return false;
    }
    if (expiresAt <= Date.now()) {
      tombstones.delete(lensId);
      return false;
    }
    return true;
  };

  return {
    handleEvent(event: ContextLensEvent) {
      if (stopping || stopped) {
        return;
      }
      const lens = event.lens;
      if (!isGroupConversationLens(lens)) {
        return;
      }
      // A state that already published and aged out keeps a lightweight public
      // tombstone. Late terminal/event-bus replay must not create a duplicate
      // carrier; genuine continuations receive a new Lens id.
      if (!states.has(lens.lensId) && hasLiveTombstone(lens.lensId)) {
        return;
      }
      const existing = states.get(lens.lensId);
      if (!existing && !isContextLensCardEligible(lens)) {
        return;
      }
      const state = ensureState(lens);
      const retryPending = Boolean(state.retryTimer);
      state.dirty = true;
      if (TERMINAL_STATUSES.has(lens.status)) {
        // Terminal state is user-visible and bypasses a pending working-state
        // backoff. It receives a fresh bounded terminal retry cycle.
        state.retryAttempt = 0;
        clearTimer(state, 'retryTimer');
        clearTimer(state, 'heartbeatTimer');
        schedule(state, true);
        return;
      }
      // Coalesce activity churn into the in-flight attempt or its pending
      // backoff. The input generation check will publish the latest snapshot.
      if (state.publishing || retryPending) {
        return;
      }
      schedule(state, !state.carrier);
    },

    buildFinalProjection(lens: ContextLens, outcome: 'completed' | 'failed') {
      const existing = states.has(lens.lensId);
      if (
        stopping ||
        stopped ||
        !isGroupConversationLens(lens) ||
        (!existing && !isContextLensCardEligible(lens))
      ) {
        return null;
      }
      const state = ensureState(lens);
      const candidate = options.project(lens, {
        surface: 'final',
        finalReplyDelivered: true,
        revision: state.revision + 1,
        outcome,
      });
      if (!candidate) {
        return null;
      }
      const projection = materializeProjection(state, candidate);
      state.preparedFinalProjection = projection;
      return projection;
    },

    registerFinalReply(params: {
      lens: ContextLens;
      sentAt: number;
      story: Story;
      blob: string;
      parentId?: string;
      participantActivity: ParticipantAgentActivityProjectionV1;
      outcome: 'completed' | 'failed';
    }) {
      if (stopping || stopped || !isGroupConversationLens(params.lens)) {
        return;
      }
      const conversationId = params.lens.triggerDetails.conversationId?.trim();
      if (!conversationId) {
        return;
      }
      const state = ensureState(params.lens);
      const initialProjection =
        ParticipantAgentActivityProjectionV1Schema.parse(
          params.participantActivity
        );
      state.finalPost = {
        post: null,
        sentAt: params.sentAt,
        baseBlob: params.blob,
        initialProjection,
        outcome: params.outcome,
        draft: {
          conversationId,
          authorId: options.botShip,
          ...(params.parentId ? { parentId: params.parentId } : {}),
          story: params.story,
          blob: params.blob,
          participantActivity: initialProjection,
          botProfile: options.getBotProfile(),
        },
      };
      state.finalProjection = initialProjection;
      state.finalSemantic = semanticProjection(initialProjection);
      state.preparedFinalProjection = null;
      state.revision = Math.max(state.revision, initialProjection.revision);
      state.lastPublicUpdatedAt = Math.max(
        state.lastPublicUpdatedAt,
        initialProjection.updatedAt
      );
      state.dirty = true;
      clearTimer(state, 'heartbeatTimer');
      schedule(state, true);
    },

    async flush() {
      if (stopped) {
        return;
      }
      for (const state of states.values()) {
        clearTimer(state, 'timer');
      }
      await drainQueuedWork();
    },

    stop() {
      if (stopPromise) {
        return stopPromise;
      }
      stopPromise = (async () => {
        stopping = true;
        for (const state of states.values()) {
          clearTimer(state, 'timer');
          clearTimer(state, 'heartbeatTimer');
          clearTimer(state, 'retryTimer');
          clearTimer(state, 'evictionTimer');
          if (state.latestLens && !state.finalPost) {
            // This also covers a create that is currently in flight. The queued
            // pass will terminalize it if it lands, but will not create a new
            // carrier solely because shutdown began.
            state.forcedOutcome = 'cancelled';
            state.inputVersion += 1;
            state.dirty = true;
          }
        }

        // Transport update already performs host-confirmation retries. Give a
        // failed terminal edit two additional publisher attempts, without
        // allowing an unbounded retry timer to hold shutdown open.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await drainQueuedWork();
          if (![...states.values()].some((state) => state.dirty)) {
            break;
          }
        }

        stopped = true;
        if (tombstoneSweepTimer) {
          clearTimeout(tombstoneSweepTimer);
          tombstoneSweepTimer = null;
        }
        for (const state of states.values()) {
          state.latestLens = null;
          clearTimer(state, 'timer');
          clearTimer(state, 'heartbeatTimer');
          clearTimer(state, 'retryTimer');
          clearTimer(state, 'evictionTimer');
        }
        states.clear();
        tombstones.clear();
      })();
      return stopPromise;
    },
  };
}
