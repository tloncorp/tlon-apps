export const DAY = 24 * 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
export const VERSION = 1;
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
export type Direction = 'useful' | 'archive' | 'routine';
export type StepId = (typeof STEPS)[number]['id'] | 'task-feedback';
export type CampaignTask = {
  id: string;
  name: string;
  enabled: boolean;
  deliveredAt?: number;
  failedAt?: number;
};
export type CampaignState = {
  owner: string;
  version: number;
  enrolledAt: number;
  timezone?: string;
  direction?: Direction;
  status: 'active' | 'feedback' | 'completed' | 'converted' | 'opted-out';
  groupId?: string;
  channelId?: string;
  destination?: string;
  topic?: string;
  purpose?: string;
  lastOwnerText?: string;
  offeredAt?: number;
  openedAt?: number;
  activityMinute?: number;
  sent: { step: StepId; at: number; text?: string; destination?: string }[];
  skipped: { step: StepId; reason: string }[];
  lastReplyAt?: number;
  lastActivityAt?: number;
};
export type CampaignConfig = {
  enabled?: boolean;
  enrollAfter?: string;
  direction?: Direction;
  copy?: Partial<Record<StepId, string>>;
};
export type CampaignFacts = {
  enabled: boolean;
  hasTask: boolean;
  task?: CampaignTask;
  busy: boolean;
  visible?: boolean;
  lastActivityAt?: number;
};
export type Decision =
  | { kind: 'send'; step: StepId }
  | {
      kind: 'skip';
      step: StepId;
      reason:
        | 'expired-slot'
        | 'unanswered'
        | 'already-offered'
        | 'context-changed';
    }
  | { kind: 'finish'; status: 'completed' }
  | { kind: 'defer'; reason?: string };

export function validTimezone(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
export function localMinute(now: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return (
    Number(parts.find((p) => p.type === 'hour')?.value) * 60 +
    Number(parts.find((p) => p.type === 'minute')?.value)
  );
}
export function evaluateCampaign(
  state: CampaignState,
  facts: CampaignFacts,
  now: number
): Decision {
  if (state.status === 'completed' || state.status === 'opted-out')
    return { kind: 'defer' };
  if (now >= state.enrolledAt + 7 * DAY || state.sent.length >= 5)
    return { kind: 'finish', status: 'completed' };
  if (!facts.enabled) return { kind: 'defer', reason: 'disabled' };
  const feedbackPhase =
    facts.hasTask ||
    state.status === 'feedback' ||
    state.status === 'converted';
  const resultAt = facts.task?.failedAt ?? facts.task?.deliveredAt;
  const feedbackDue =
    feedbackPhase &&
    resultAt !== undefined &&
    (state.openedAt ?? 0) > resultAt &&
    now - (state.openedAt ?? 0) < 90_000 &&
    !state.sent.some((s) => s.step === 'task-feedback');
  const step = feedbackDue
    ? { id: 'task-feedback' as const, start: 0, end: 7 * DAY }
    : STEPS.find(
        (candidate) =>
          (!feedbackPhase || candidate.id === 'closing') &&
          !state.sent.some((s) => s.step === candidate.id) &&
          !state.skipped.some((s) => s.step === candidate.id)
      );
  if (!step) return { kind: 'finish', status: 'completed' };
  if (now >= state.enrolledAt + step.end)
    return { kind: 'skip', step: step.id, reason: 'expired-slot' };
  if (now < state.enrolledAt + step.start) return { kind: 'defer' };
  const direction = state.direction ?? 'useful';
  const equivalentOffer =
    (direction === 'useful' && step.id === 'recurring-help') ||
    (direction === 'archive' && step.id === 'own-material') ||
    (direction === 'routine' && step.id === 'archive');
  if (step.id === 'useful-request' && state.lastReplyAt)
    return { kind: 'skip', step: step.id, reason: 'context-changed' };
  if (equivalentOffer && state.offeredAt)
    return { kind: 'skip', step: step.id, reason: 'already-offered' };
  const unanswered = state.sent.filter(
    (s) => s.at > (state.lastReplyAt ?? 0)
  ).length;
  if (unanswered >= 2 && step.id !== 'closing' && step.id !== 'task-feedback')
    return { kind: 'skip', step: step.id, reason: 'unanswered' };
  const lastSend = state.sent.at(-1)?.at;
  if (facts.busy || (!feedbackDue && facts.visible))
    return { kind: 'defer', reason: 'active-conversation' };
  if (
    now - Math.max(facts.lastActivityAt ?? 0, state.lastActivityAt ?? 0) <
    RECENT_ACTIVITY_MS
  )
    return { kind: 'defer', reason: 'recent-message' };
  if (!feedbackDue && lastSend !== undefined && now - lastSend < DAY)
    return { kind: 'defer', reason: 'spacing' };
  if (!validTimezone(state.timezone))
    return { kind: 'defer', reason: 'timezone-unavailable' };
  const minute = localMinute(now, state.timezone);
  if (minute < DAYTIME_START * 60 || minute >= DAYTIME_END * 60)
    return { kind: 'defer', reason: 'quiet-hours' };
  const preferred = Math.max(
    DAYTIME_START * 60,
    Math.min(
      DAYTIME_END * 60 - 1,
      state.activityMinute ?? localMinute(state.enrolledAt, state.timezone)
    )
  );
  if (!feedbackDue && minute < preferred)
    return { kind: 'defer', reason: 'usual-activity-time' };
  return { kind: 'send', step: step.id };
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
