import { sharedMap } from './shared-state.js';

interface TimedValue<T> {
  timestamp: number;
  value: T;
}

interface OwnerPromptState {
  generation: number;
  prompt: string;
  timestamp: number;
  trusted: boolean;
}

interface CronSnapshot {
  id: string;
  message: string;
  delivery: unknown;
  deliveryMode: string | null;
  enabled: unknown;
  hasDelivery: boolean;
  hasEnabled: boolean;
  hasSchedule: boolean;
  promptGeneration: number;
  schedule: unknown;
}

const STATE_TTL_MS = 60 * 60 * 1000;
const ownerPrompts = sharedMap<string, OwnerPromptState>(
  'conditionalCronUpdate.ownerPrompts'
);
const cronSnapshots = sharedMap<string, TimedValue<CronSnapshot>>(
  'conditionalCronUpdate.snapshots'
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanup(now = Date.now()): void {
  for (const [key, entry] of ownerPrompts) {
    if (now - entry.timestamp > STATE_TTL_MS) {
      ownerPrompts.delete(key);
    }
  }
  for (const [key, entry] of cronSnapshots) {
    if (now - entry.timestamp > STATE_TTL_MS) {
      cronSnapshots.delete(key);
    }
  }
}

function parentSessionKey(sessionKey: string): string {
  const threadIndex = sessionKey.indexOf(':thread:');
  return threadIndex > 0 ? sessionKey.slice(0, threadIndex) : sessionKey;
}

function snapshotKey(sessionKey: string, jobId: string): string {
  return `${parentSessionKey(sessionKey)}\u0000${jobId}`;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cronResultObject(result: unknown): Record<string, unknown> | null {
  const direct = parseJsonObject(result);
  if (!direct) {
    return null;
  }
  const details = parseJsonObject(direct.details);
  if (details) {
    return details;
  }
  if (Array.isArray(direct.content)) {
    for (const item of direct.content) {
      if (!isRecord(item) || item.type !== 'text') {
        continue;
      }
      const parsed = parseJsonObject(item.text);
      if (parsed) {
        return parsed;
      }
    }
  }
  return direct;
}

function cronMessage(job: Record<string, unknown>): string | null {
  const payload = isRecord(job.payload) ? job.payload : null;
  const message = payload?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

function cronDeliveryMode(job: Record<string, unknown>): string | null {
  const delivery = isRecord(job.delivery) ? job.delivery : null;
  const mode = delivery?.mode;
  return typeof mode === 'string' && mode.trim()
    ? mode.trim().toLowerCase()
    : null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function explicitlyChangesMonitorScope(prompt: string): boolean {
  const normalized = prompt.replace(/[’‘]/g, "'");
  return (
    /\b(?:replace|switch|broaden|all sources|any source|stop monitoring|change (?:the )?(?:subject|source|scope|topic))\b/i.test(
      normalized
    ) ||
    /\b(?:only|now)\s+(?:monitor|check|watch|use|search)\b/i.test(normalized) ||
    /\b(?:monitor|check|watch|use|search)\b[^.!?\n]*(?:\binstead\b|\bnow\b)/i.test(
      normalized
    ) ||
    /\bonly\s+(?:alert|notify|message|tell)(?:\s+me)?\s+about\b[^.!?\n]*(?:\bnow\b|\binstead\b|\bnot\b)/i.test(
      normalized
    ) ||
    /\b(?:switch|replace|change)\b[^.!?\n]*\b(?:source|sources|feed|feeds|site|sites|website|websites)\b/i.test(
      normalized
    )
  );
}

function hasUnrelatedSideEffect(prompt: string): boolean {
  const clauses = prompt
    .split(/(?<=[.!?])\s+|\n+|;\s*|,?\s+and\s+/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  return clauses.some((clause) => {
    if (
      !/\b(?:delete|remove|create|rename|move|edit|write|save|post|upload|download|invite|leave|join|archive|install|buy|pay|book|call|email)\b/i.test(
        clause
      )
    ) {
      return false;
    }
    return !/\b(?:alert|notify|notification|monitor|update|bother|message|tell|send|urgent|risk|routine|threshold|relevant)\b/i.test(
      clause
    );
  });
}

function isThresholdCorrection(prompt: string): boolean {
  const normalized = prompt.replace(/[’‘]/g, "'");
  const hasThresholdLanguage =
    /\b(?:not|don't|do not|only|unless|ignore|suppress|routine|known|safe|risk|urgent|important|relevant)\b/i.test(
      normalized
    );
  const concernsDelivery =
    /\b(?:alert|notify|notification|monitor|update|bother|message|tell|send|urgent|risk)\b/i.test(
      normalized
    );
  return (
    hasThresholdLanguage &&
    concernsDelivery &&
    !explicitlyChangesMonitorScope(normalized) &&
    !hasUnrelatedSideEffect(normalized)
  );
}

function explicitlyChangesSchedule(prompt: string): boolean {
  return /\bevery\b[^.!?\n]{0,40}\b(?:minute|hour|day|week|month)s?\b|\b(?:hourly|daily|weekly|monthly|schedule|cadence|frequency|run\s+(?:at|on)|cron)\b/i.test(
    prompt
  );
}

function explicitlyChangesEnabled(prompt: string): boolean {
  return /\b(?:enable|disable|pause|resume|start|stop)\b[^.!?\n]{0,80}\b(?:job|schedule|task|monitor|running|run)\b|\bturn\b[^.!?\n]{0,80}\b(?:on|off)\b/i.test(
    prompt
  );
}

function explicitlyChangesDelivery(prompt: string): boolean {
  return /\b(?:announc(?:e|ing)|delivery\s+mode|send|deliver|post)\b[^.!?\n]{0,80}\b(?:instead|direct|channel|dm|message|nowhere|none)\b|\b(?:don't|do not|stop)\s+(?:announc(?:e|ing)|send|deliver|post)\b/i.test(
    prompt
  );
}

export function rememberCronOwnerPrompt(
  sessionKey: string | undefined,
  prompt: string,
  senderIsOwner: boolean | undefined
): void {
  const value = prompt.trim();
  if (!sessionKey || !value) {
    return;
  }
  cleanup();
  const key = parentSessionKey(sessionKey);
  const existing = ownerPrompts.get(key);
  if (senderIsOwner === true) {
    ownerPrompts.set(key, {
      generation: (existing?.generation ?? 0) + 1,
      prompt: value,
      timestamp: Date.now(),
      trusted: true,
    });
    return;
  }

  // A Tlon inbound message records trusted ownership before this generic hook.
  // Preserve that record when both hooks saw the same text. A different
  // ownerless/internal prompt deactivates it without treating the background
  // text as an owner correction.
  if (
    senderIsOwner === undefined &&
    existing?.trusted &&
    existing.prompt === value
  ) {
    return;
  }
  ownerPrompts.set(key, {
    generation: (existing?.generation ?? 0) + 1,
    prompt: existing?.prompt ?? '',
    timestamp: Date.now(),
    trusted: false,
  });
}

export function hasTrustedCronOwnerPrompt(
  sessionKey: string | undefined
): boolean {
  if (!sessionKey) return false;
  cleanup();
  return ownerPrompts.get(parentSessionKey(sessionKey))?.trusted === true;
}

export function recordCronGetResult(
  sessionKey: string | undefined,
  params: Record<string, unknown>,
  result: unknown,
  error?: unknown
): void {
  if (!sessionKey) {
    return;
  }
  const requestedJobId =
    typeof params.jobId === 'string'
      ? params.jobId
      : typeof params.id === 'string'
        ? params.id
        : null;
  if (params.action === 'update') {
    const failed =
      (typeof error === 'string' && error.trim().length > 0) ||
      (error !== null && error !== undefined && typeof error !== 'string');
    if (requestedJobId && !failed) {
      // The after-tool hook cannot reliably recover the effective params after
      // a before-tool rewrite. Force a fresh exact-job read before another
      // correction rather than rebuilding from stale pre-update content.
      cronSnapshots.delete(snapshotKey(sessionKey, requestedJobId));
    }
    return;
  }
  if (params.action !== 'get') return;
  const promptState = ownerPrompts.get(parentSessionKey(sessionKey));
  if (!promptState?.trusted) return;
  const job = cronResultObject(result);
  if (!job) {
    return;
  }
  const id = typeof job.id === 'string' ? job.id : null;
  const message = cronMessage(job);
  if (!id || !message) {
    return;
  }
  cleanup();
  cronSnapshots.set(snapshotKey(sessionKey, id), {
    timestamp: Date.now(),
    value: {
      id,
      message,
      delivery: job.delivery,
      deliveryMode: cronDeliveryMode(job),
      enabled: job.enabled,
      hasDelivery: hasOwn(job, 'delivery'),
      hasEnabled: hasOwn(job, 'enabled'),
      hasSchedule: hasOwn(job, 'schedule'),
      promptGeneration: promptState.generation,
      schedule: job.schedule,
    },
  });
}

export function preserveConditionalCronUpdate(
  sessionKey: string | undefined,
  params: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!sessionKey || params.action !== 'update') {
    return undefined;
  }
  cleanup();
  const canonicalSessionKey = parentSessionKey(sessionKey);
  const promptState = ownerPrompts.get(canonicalSessionKey);
  const prompt = promptState?.prompt;
  if (!promptState?.trusted || !prompt || !isThresholdCorrection(prompt)) {
    return undefined;
  }

  const jobId =
    typeof params.jobId === 'string'
      ? params.jobId
      : typeof params.id === 'string'
        ? params.id
        : null;
  if (!jobId) {
    return undefined;
  }
  const currentSnapshots = Array.from(cronSnapshots.entries()).filter(
    ([key, entry]) =>
      key.startsWith(`${canonicalSessionKey}\u0000`) &&
      entry.value.promptGeneration === promptState.generation
  );
  if (currentSnapshots.length !== 1) {
    return undefined;
  }
  const previous = cronSnapshots.get(snapshotKey(sessionKey, jobId))?.value;
  if (!previous || previous.promptGeneration !== promptState.generation) {
    return undefined;
  }

  const patch = isRecord(params.patch) ? params.patch : null;
  if (!patch) return undefined;
  const payload = isRecord(patch.payload) ? patch.payload : null;
  if (!payload) return undefined;
  const proposedMessage = payload?.message;
  if (typeof proposedMessage !== 'string' || !proposedMessage.trim()) {
    return undefined;
  }
  const correction = prompt.trim();
  const keepProposedDelivery =
    explicitlyChangesDelivery(correction) && hasOwn(patch, 'delivery');
  const effectiveDeliveryMode = keepProposedDelivery
    ? cronDeliveryMode({ delivery: patch.delivery })
    : previous.deliveryMode;
  const announceRule =
    effectiveDeliveryMode === 'announce'
      ? '\nThis job uses delivery.mode=announce: never call or use the message tool for delivery. Return alert text only through announce delivery.'
      : '';
  const correctedMessage = `${previous.message}\n\nOwner correction (higher priority):\n${correction}\nThis correction overrides any conflicting earlier delivery instruction. Preserve the original subject, sources, and input scope; do not introduce unrelated events.${announceRule}\nWhen the corrected alert criteria are not met, return exactly NO_REPLY with no heartbeat, status update, or explanation.`;

  // Presence checks are insufficient: a proposal can contain every required
  // sentence and append a conflicting broad alert criterion. Only the exact
  // canonical form is accepted unchanged.
  if (proposedMessage === correctedMessage) {
    const changesControlFields = ['delivery', 'enabled', 'schedule'].some(
      (key) => hasOwn(patch, key)
    );
    if (!changesControlFields) return undefined;
  }

  // A threshold-only correction must not silently change when a job runs,
  // whether it remains enabled, or how it is delivered. Restore those fields
  // from the exact-job read so the rewritten message and its announce rule
  // describe the effective update that will actually be applied.
  const safePatch = { ...patch };
  if (!keepProposedDelivery) {
    delete safePatch.delivery;
    if (previous.hasDelivery) safePatch.delivery = previous.delivery;
  }
  if (!explicitlyChangesEnabled(correction)) {
    delete safePatch.enabled;
    if (previous.hasEnabled) safePatch.enabled = previous.enabled;
  }
  if (!explicitlyChangesSchedule(correction)) {
    delete safePatch.schedule;
    if (previous.hasSchedule) safePatch.schedule = previous.schedule;
  }

  return {
    ...params,
    patch: {
      ...safePatch,
      payload: {
        ...payload,
        message: correctedMessage,
      },
    },
  };
}

export const _testing = {
  clear: () => {
    ownerPrompts.clear();
    cronSnapshots.clear();
  },
};
