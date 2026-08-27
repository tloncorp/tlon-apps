import { sharedMap } from './shared-state.js';

interface TimedValue<T> {
  timestamp: number;
  value: T;
}

interface CronSnapshot {
  id: string;
  message: string;
}

const STATE_TTL_MS = 60 * 60 * 1000;
const ownerPrompts = sharedMap<string, TimedValue<string>>(
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

function snapshotKey(sessionKey: string, jobId: string): string {
  return `${sessionKey}\u0000${jobId}`;
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

function isThresholdCorrection(prompt: string): boolean {
  const hasThresholdLanguage =
    /\b(?:not|don't|do not|only|unless|ignore|suppress|routine|known|safe|risk|urgent|important|relevant)\b/i.test(
      prompt
    );
  const concernsDelivery =
    /\b(?:alert|notify|notification|monitor|update|bother|message|tell|send|urgent|risk)\b/i.test(
      prompt
    );
  const explicitlyChangesScope =
    /\b(?:replace|switch|broaden|all sources|any source|stop monitoring|change (?:the )?(?:subject|source|scope|topic))\b/i.test(
      prompt
    );
  return hasThresholdLanguage && concernsDelivery && !explicitlyChangesScope;
}

export function rememberCronOwnerPrompt(
  sessionKey: string | undefined,
  prompt: string,
  senderIsOwner: boolean | undefined
): void {
  if (!sessionKey || senderIsOwner === false || !prompt.trim()) {
    return;
  }
  cleanup();
  ownerPrompts.set(sessionKey, { timestamp: Date.now(), value: prompt.trim() });
}

export function recordCronGetResult(
  sessionKey: string | undefined,
  params: Record<string, unknown>,
  result: unknown
): void {
  if (!sessionKey || params.action !== 'get') {
    return;
  }
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
    value: { id, message },
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
  const prompt = ownerPrompts.get(sessionKey)?.value;
  if (!prompt || !isThresholdCorrection(prompt)) {
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
  const previous = cronSnapshots.get(snapshotKey(sessionKey, jobId))?.value;
  if (!previous) {
    return undefined;
  }

  const patch = isRecord(params.patch) ? params.patch : null;
  const payload = patch && isRecord(patch.payload) ? patch.payload : null;
  const proposedMessage = payload?.message;
  if (typeof proposedMessage !== 'string' || !proposedMessage.trim()) {
    return undefined;
  }
  if (proposedMessage.includes(previous.message)) {
    return undefined;
  }

  const correctedMessage = `${previous.message}\n\nOwner correction (higher priority):\n${prompt}\nThis correction overrides any conflicting earlier delivery instruction. Preserve the original subject, sources, and input scope; do not introduce unrelated events. When the corrected alert criteria are not met, return exactly NO_REPLY with no heartbeat, status update, or explanation.`;

  return {
    ...params,
    patch: {
      ...patch,
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
