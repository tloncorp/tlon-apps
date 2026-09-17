export const DAY = 24 * 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
export const VERSION = 1;
// Product defaults, not learned activity patterns.
export const RECENT_ACTIVITY_MS = 15 * MINUTE;
export const DAYTIME_START = 9;
export const DAYTIME_END = 21;
export const STEPS = [
  { id: 'useful-request', start: DAY, end: 2 * DAY },
  { id: 'recurring-help', start: 2 * DAY, end: 3 * DAY },
  { id: 'archive', start: 3 * DAY, end: 4 * DAY },
  { id: 'own-material', start: 5 * DAY, end: 6 * DAY },
  { id: 'closing', start: 6 * DAY, end: 7 * DAY },
] as const;
export type StepId = (typeof STEPS)[number]['id'];
export type CampaignState = {
  owner: string;
  version: number;
  enrolledAt: number;
  timezone?: string;
  status: 'active' | 'completed' | 'converted' | 'opted-out';
  sent: { step: StepId; at: number }[];
  skipped: { step: StepId; reason: string }[];
  lastReplyAt?: number;
  lastActivityAt?: number;
};
export type CampaignConfig = {
  enabled?: boolean;
  /** Explicit rollout boundary, not an inferred account creation time. */
  enrollAfter?: string;
};
export type CampaignFacts = {
  enabled: boolean;
  hasTask: boolean;
  busy: boolean;
  lastActivityAt?: number;
};
export type Decision =
  | { kind: 'send'; step: StepId }
  | { kind: 'skip'; step: StepId; reason: 'expired-slot' | 'unanswered' }
  | { kind: 'finish'; status: 'completed' | 'converted' }
  | { kind: 'defer' };

export function validTimezone(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function evaluateCampaign(
  state: CampaignState,
  facts: CampaignFacts,
  now: number
): Decision {
  if (state.status !== 'active') return { kind: 'defer' };
  if (facts.hasTask) return { kind: 'finish', status: 'converted' };
  if (now >= state.enrolledAt + 7 * DAY || state.sent.length >= 5) {
    return { kind: 'finish', status: 'completed' };
  }
  if (!facts.enabled) return { kind: 'defer' };
  const step = STEPS.find(
    (candidate) =>
      !state.sent.some((sent) => sent.step === candidate.id) &&
      !state.skipped.some((skip) => skip.step === candidate.id)
  );
  if (!step) return { kind: 'finish', status: 'completed' };
  if (now >= state.enrolledAt + step.end) {
    return { kind: 'skip', step: step.id, reason: 'expired-slot' };
  }
  const unanswered = state.sent.filter(
    (sent) => sent.at > (state.lastReplyAt ?? 0)
  ).length;
  if (unanswered >= 2 && step.id !== 'closing') {
    return { kind: 'skip', step: step.id, reason: 'unanswered' };
  }
  const lastSend = state.sent.at(-1)?.at;
  if (
    now < state.enrolledAt + step.start ||
    (lastSend !== undefined && now - lastSend < DAY) ||
    facts.busy ||
    now - Math.max(facts.lastActivityAt ?? 0, state.lastActivityAt ?? 0) <
      RECENT_ACTIVITY_MS ||
    !validTimezone(state.timezone)
  )
    return { kind: 'defer' };
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: state.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  );
  return hour >= DAYTIME_START && hour < DAYTIME_END
    ? { kind: 'send', step: step.id }
    : { kind: 'defer' };
}

export function eligibleEnrollment(
  input: {
    isFirstGroup?: boolean;
    campaignVersion?: number;
    occurredAt: number;
  },
  config: CampaignConfig,
  now: number
): boolean {
  const cutoff = Date.parse(config.enrollAfter ?? '');
  return (
    config.enabled === true &&
    Number.isFinite(cutoff) &&
    input.isFirstGroup === true &&
    input.campaignVersion === VERSION &&
    input.occurredAt >= cutoff &&
    input.occurredAt <= now &&
    now - input.occurredAt <= 5 * MINUTE
  );
}
