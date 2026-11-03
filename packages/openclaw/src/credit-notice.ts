import { randomUUID } from 'node:crypto';

import type {
  BudgetHoldState,
  BudgetState,
  CreditSignal,
} from './cron-budget-hold.js';

/** Below this share of its key's limit, the owner hears that credit is low. */
export const LOW_CREDIT_RATIO = 0.2;
// Hosting moves the bot to a free model below this share
// (OPENROUTER_LOW_CREDIT_THRESHOLD in tlonbot's entrypoint/tlawn.py).
const LIMITED_CREDIT_RATIO = 0.05;

/** A key out of credit stays out for hours; tell the owner at most this often. */
export const CREDIT_FAILURE_NOTICE_COOLDOWN_MS = 6 * 60 * 60_000;

type NoticeLevel = NonNullable<BudgetHoldState['noticeLevel']>;
const RANK: Record<NoticeLevel, number> = { low: 1, limited: 2 };

function remainingShare(credit: CreditSignal | null): number | null {
  if (!credit || credit.remainingUsd === null || !credit.limitUsd) return null;
  return credit.limitUsd > 0
    ? Math.max(0, credit.remainingUsd) / credit.limitUsd
    : null;
}

const usd = (amount: number) => `$${amount.toFixed(2)}`;

export function creditNoticeText(
  level: NoticeLevel,
  credit: CreditSignal | null,
  pausedTasks: number
): string {
  // Hosting only limits Tlon's included plan.
  if (level === 'limited') {
    const paused =
      pausedTasks > 0
        ? ` and paused your ${pausedTasks} scheduled ${pausedTasks === 1 ? 'task' : 'tasks'}`
        : '';
    return `You've used almost all of this month's included credits, so I've switched to a free model${paused} until they reset.`;
  }
  if (credit?.keyOwner === 'owner' && credit.remainingUsd !== null) {
    return `Your OpenRouter key has ${usd(Math.max(0, credit.remainingUsd))} of its ${usd(credit.limitUsd ?? 0)} limit left. When it runs out, I can't reply until you add credits or raise its limit on OpenRouter.`;
  }
  return `You've used over ${Math.round((1 - LOW_CREDIT_RATIO) * 100)}% of this month's included credits. When they're nearly gone, I'll switch to a free model until they reset.`;
}

/**
 * Tells the owner once as their OpenRouter credit runs low and again when
 * hosting limits it. Runs after a clean reconcileBudgetHolds pass, since the
 * limited notice counts the tasks that pass paused. `notify` gets the text and
 * whether to offer a credit increase, which only Tlon's own key can get.
 */
export async function reconcileCreditNotice(opts: {
  budget: BudgetState;
  credit: CreditSignal | null;
  state: BudgetHoldState;
  save: () => Promise<void>;
  notify?: (message: string, offerIncrease: boolean) => Promise<boolean>;
  now?: () => number;
}): Promise<void> {
  const { state, credit, save } = opts;
  // Plugins before the low notice tracked only a limited one, under the hold
  // episode's id.
  if (state.noticeLevel === undefined && state.limited && state.notified) {
    state.noticeLevel = 'limited';
    state.noticeId = state.episodeId;
  }
  const share = remainingShare(credit);
  const level: NoticeLevel | null | undefined = state.limited
    ? 'limited'
    : opts.budget === 'unknown'
      ? undefined
      : share !== null && share < LOW_CREDIT_RATIO
        ? 'low'
        : null;
  if (level === null) {
    if (state.noticeLevel || state.notified) {
      delete state.noticeLevel;
      delete state.noticeId;
      state.notified = false;
      delete state.notifiedRecipients;
      delete state.notificationAttempts;
      delete state.nextNotificationAtMs;
      await save();
    }
    return;
  }
  if (level && level !== state.noticeLevel) {
    // Falling back from limited to low has nothing new to say.
    if (!state.noticeLevel || RANK[level] > RANK[state.noticeLevel]) {
      state.noticeId = randomUUID();
      state.notified = false;
      delete state.notifiedRecipients;
      delete state.notificationAttempts;
      delete state.nextNotificationAtMs;
    }
    state.noticeLevel = level;
    await save();
  }

  const noticeLevel = state.noticeLevel;
  // A low notice names the key, which an unread probe doesn't.
  if (!noticeLevel || (noticeLevel === 'low' && !credit)) return;
  const now = (opts.now ?? Date.now)();
  if (
    state.notified ||
    !opts.notify ||
    now < (state.nextNotificationAtMs ?? 0)
  ) {
    return;
  }
  // Persist before delivery so throws or restarts cannot reset the backoff.
  // Reconciliation still runs every five seconds, independently of notices.
  const attempts = state.notificationAttempts ?? 0;
  state.notificationAttempts = Math.min(attempts + 1, 5);
  state.nextNotificationAtMs =
    now + Math.min(60_000 * 2 ** Math.min(attempts, 4), 900_000);
  await save();
  // An intent left by a failed update is not a paused task.
  const paused = Object.values(state.holds).filter(
    (hold) => hold.revision !== undefined
  ).length;
  if (
    await opts.notify(
      creditNoticeText(noticeLevel, credit, paused),
      noticeLevel === 'limited' || credit?.keyOwner === 'tlon'
    )
  ) {
    state.notified = true;
    delete state.notificationAttempts;
    delete state.nextNotificationAtMs;
    await save();
  }
}

// Core's reply when a provider refuses an API key for billing
// (`formatBillingErrorMessage` in OpenClaw's agents/failover/user-copy.ts,
// not exported). A key core has put in billing cooldown fails the next turns
// without calling the provider, and those runs carry no failover reason, so
// this copy is the one signal every such turn shares.
const API_KEY_BILLING_REPLY =
  'returned a billing error — your API key has run out of credits';

export function isApiKeyBillingReply(text: string | undefined): text is string {
  return text?.includes(API_KEY_BILLING_REPLY) === true;
}

// `⚠️ <provider> (<model>) returned …`; core writes `⚠️ API provider
// returned …` when it doesn't know the provider.
const BILLING_REPLY_PROVIDER =
  /⚠️ (\S+)(?: \([^)]*\))? returned a billing error/;

export type BillingFailure = {
  /** Null when it wasn't the owner's credit: Tlon's own account refused it. */
  keyOwner: CreditSignal['keyOwner'] | null;
  /** The provider core's reply names, or null when it names none. */
  provider: string | null;
};

/** Whose credit the billing failure in core's reply ran out of. */
export function describeBillingFailure(
  reply: string,
  signal: { state: BudgetState; credit: CreditSignal | null }
): BillingFailure {
  const provider = BILLING_REPLY_PROVIDER.exec(reply)?.[1] ?? null;
  // Tlon only provides an OpenRouter key, and the signal describes only that.
  if (provider !== null && provider !== 'openrouter') {
    return { keyOwner: 'owner', provider };
  }
  if (signal.credit?.keyOwner === 'owner')
    return { keyOwner: 'owner', provider };
  const share = remainingShare(signal.credit);
  // Tlon's key with credit left failed on Tlon's own account.
  const spent =
    signal.state === 'limited' ||
    (share !== null && share < LIMITED_CREDIT_RATIO);
  return { keyOwner: spent ? 'tlon' : null, provider };
}

/** `failed` completes "I couldn't …", e.g. `run your scheduled task "Digest"`. */
export function creditFailureNoticeText(
  keyOwner: CreditSignal['keyOwner'],
  provider: string | null,
  failed: string
): string {
  if (keyOwner === 'tlon') {
    return `⚠️ I couldn't ${failed}: this month's included credits are used up.`;
  }
  return provider === null || provider === 'openrouter'
    ? `⚠️ I couldn't ${failed}: your OpenRouter key is out of credits. Add credits or raise its limit on OpenRouter.`
    : `⚠️ I couldn't ${failed}: your ${provider} API key is out of credits. Add credits to your ${provider} account or switch to a different key.`;
}
