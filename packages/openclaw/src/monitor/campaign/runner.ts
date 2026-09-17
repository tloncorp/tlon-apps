import {
  type CampaignConfig,
  type CampaignState,
  type StepId,
  MINUTE,
  VERSION,
  STEPS,
  eligibleEnrollment,
  evaluateCampaign,
  validTimezone,
} from './model.js';
import {
  type CampaignStore,
  getCampaignStore,
  saveCampaign,
  withCampaignLock,
} from './store.js';
import { TEMPLATES, isStopTips } from './templates.js';

export type CampaignEvent = {
  action: 'enrolled' | 'sent' | 'skipped' | 'reply' | 'opted-out';
  version: number;
  enrolledAt: number;
  step?: StepId;
  reason?: string;
};
export type CampaignDeps = {
  owner: string;
  config: () => CampaignConfig;
  store?: () => CampaignStore | null;
  hasTask: () => Promise<boolean>;
  busy: () => boolean;
  readMarker: (key: string) => Promise<number | undefined>;
  send: (text: string, key?: string) => Promise<void>;
  report: (event: CampaignEvent) => void;
  error: (error: unknown) => void;
  now?: () => number;
  signal?: AbortSignal;
};

export function createCampaign(deps: CampaignDeps) {
  const now = deps.now ?? Date.now;
  const getStore = deps.store ?? getCampaignStore;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let flight: Promise<void> | undefined;
  let lastActivityAt = 0;
  let optedOut = false;
  let converted = false;
  let pendingEnrollment: CampaignState | undefined;
  const report = (
    state: CampaignState,
    action: CampaignEvent['action'],
    extra: Partial<CampaignEvent> = {}
  ) => {
    try {
      deps.report({
        action,
        version: state.version,
        enrolledAt: state.enrolledAt,
        ...extra,
      });
    } catch (error) {
      deps.error(error);
    }
  };
  const locked = <T>(run: (store: CampaignStore) => Promise<T>) =>
    withCampaignLock(deps.owner, async () => {
      const store = getStore();
      if (!store) return;
      return run(store);
    });

  async function tick() {
    if (stopped || deps.signal?.aborted) return;
    await locked(async (store) => {
      let state = await store.lookup(deps.owner);
      if (!state && pendingEnrollment) {
        if (await store.registerIfAbsent(deps.owner, pendingEnrollment))
          report(pendingEnrollment, 'enrolled');
        state = await store.lookup(deps.owner);
      }
      if (state) pendingEnrollment = undefined;
      if (optedOut) {
        const stopState = state ?? {
          owner: deps.owner,
          version: VERSION,
          enrolledAt: now(),
          status: 'opted-out' as const,
          sent: [],
          skipped: [],
        };
        if (stopState.status !== 'opted-out' || !state) {
          await saveCampaign(store, { ...stopState, status: 'opted-out' });
          report(stopState, 'opted-out');
        }
        return;
      }
      if (!state || state.status !== 'active') return;
      const hasTask = converted || (await deps.hasTask()); // An unavailable scheduler throws: no acquisition tip.
      for (let i = 0; i <= STEPS.length; i++) {
        if (stopped || deps.signal?.aborted || optedOut) return;
        const decision = evaluateCampaign(
          state,
          {
            enabled: deps.config().enabled === true,
            hasTask,
            busy: deps.busy(),
            lastActivityAt,
          },
          now()
        );
        if (decision.kind === 'defer') return;
        if (decision.kind === 'finish') {
          await saveCampaign(store, { ...state, status: decision.status });
          return;
        }
        if (decision.kind === 'skip') {
          // A send can succeed just before a crash crosses the slot boundary.
          const recoveredAt: number | undefined =
            decision.reason === 'expired-slot'
              ? await deps.readMarker(
                  `campaign-v${state.version}-${decision.step}`
                )
              : undefined;
          if (recoveredAt !== undefined) {
            state = {
              ...state,
              sent: [...state.sent, { step: decision.step, at: recoveredAt }],
            };
            await saveCampaign(store, state);
            report(state, 'sent', { step: decision.step });
            continue;
          }
          state = {
            ...state,
            skipped: [
              ...state.skipped,
              { step: decision.step, reason: decision.reason },
            ],
          };
          await saveCampaign(store, state);
          report(state, 'skipped', {
            step: decision.step,
            reason: decision.reason,
          });
          continue;
        }
        const key = `campaign-v${state.version}-${decision.step}`;
        let sentAt = await deps.readMarker(key);
        if (sentAt === undefined) {
          // The owner can reply, stop tips, or create a task while history is fetched.
          const freshHasTask = converted || (await deps.hasTask());
          const freshDecision = evaluateCampaign(
            state,
            {
              enabled:
                deps.config().enabled === true &&
                !optedOut &&
                !stopped &&
                !deps.signal?.aborted,
              hasTask: freshHasTask,
              busy: deps.busy(),
              lastActivityAt,
            },
            now()
          );
          if (
            freshDecision.kind !== 'send' ||
            freshDecision.step !== decision.step
          )
            return;
          try {
            await deps.send(TEMPLATES[decision.step], key);
            sentAt = now();
          } catch (error) {
            sentAt = await deps.readMarker(key);
            if (sentAt === undefined) throw error;
          }
        }
        state = {
          ...state,
          sent: [...state.sent, { step: decision.step, at: sentAt }],
        };
        await saveCampaign(store, state);
        report(state, 'sent', { step: decision.step });
        return; // Never replay more than one tip per check.
      }
    });
  }
  function check(): Promise<void> {
    if (!flight) {
      flight = tick()
        .catch(deps.error)
        .finally(() => {
          flight = undefined;
        });
    }
    return flight;
  }
  async function enroll(input: {
    isFirstGroup?: boolean;
    campaignVersion?: number;
    timezone?: string;
    occurredAt: number;
  }) {
    if (!eligibleEnrollment(input, deps.config(), now())) return;
    pendingEnrollment ??= {
      owner: deps.owner,
      version: VERSION,
      enrolledAt: now(),
      ...(validTimezone(input.timezone) ? { timezone: input.timezone } : {}),
      status: 'active',
      sent: [],
      skipped: [],
    };
    await check();
  }
  async function inbound(text: string, isDm: boolean): Promise<boolean> {
    lastActivityAt = now(); // Synchronous: a send in flight sees this before persistence.
    if (isDm && isStopTips(text)) {
      optedOut = true;
      let saved = false;
      try {
        saved =
          (await locked(async (store) => {
            const state = (await store.lookup(deps.owner)) ?? {
              owner: deps.owner,
              version: VERSION,
              enrolledAt: now(),
              status: 'active' as const,
              sent: [],
              skipped: [],
            };
            await saveCampaign(store, {
              ...state,
              status: 'opted-out',
              lastActivityAt,
            });
            if (state.status !== 'opted-out') report(state, 'opted-out');
            return true;
          })) ?? false;
      } catch (error) {
        deps.error(error);
      }
      try {
        await deps.send(
          saved
            ? 'I’ve stopped the onboarding tips. Your scheduled tasks are unchanged.'
            : 'I’ve paused these tips here, but couldn’t save that preference. Please send /stop-tips again when the bot is back online. Your scheduled tasks are unchanged.'
        );
      } catch (error) {
        deps.error(error);
      }
      return true; // Never route an explicit tip opt-out into task cancellation.
    }
    await locked(async (store) => {
      const state = await store.lookup(deps.owner);
      if (!state) return;
      await saveCampaign(store, {
        ...state,
        lastActivityAt,
        ...(isDm ? { lastReplyAt: lastActivityAt } : {}),
      });
      if (isDm && state.status === 'active' && state.sent.length)
        report(state, 'reply');
    });
    return false;
  }
  async function taskCreated() {
    converted = true; // Invalidate any send already reading history.
    await locked(async (store) => {
      const state = await store.lookup(deps.owner);
      if (state?.status === 'active')
        await saveCampaign(store, { ...state, status: 'converted' });
    });
  }
  async function replyContext(): Promise<string | undefined> {
    let state: CampaignState | undefined;
    try {
      state = await getStore()?.lookup(deps.owner);
    } catch (error) {
      deps.error(error);
      return;
    }
    const last = state?.sent.at(-1);
    // Only bridge the first reply to an out-of-band tip; later normal turns have their own transcript.
    if (!state || !last || (state.lastReplyAt ?? 0) > last.at) return;
    return `[Your most recent onboarding tip in this DM]\n${TEMPLATES[last.step]}\n[The owner is replying to this conversation. Continue normally; create recurring work only after resolving the job, cadence, time, timezone and destination. To stop tips, the owner can send /stop-tips.]`;
  }
  function start() {
    if (timer || stopped || deps.signal?.aborted) return;
    timer = setInterval(() => {
      void check();
    }, MINUTE);
    timer.unref?.();
    deps.signal?.addEventListener('abort', halt, { once: true });
    void check();
  }
  function halt() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = undefined;
  }
  async function stop() {
    halt();
    deps.signal?.removeEventListener('abort', halt);
    await flight;
  }
  return { start, stop, check, enroll, inbound, replyContext, taskCreated };
}
