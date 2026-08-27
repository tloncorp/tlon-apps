export type FileReadToolResult = {
  runId?: string;
  toolName: string;
  result?: unknown;
  error?: string;
};

export type FileReadFinalizeInput = {
  runId?: string;
  lastAssistantMessage?: string;
};

export type FileReadRevision = {
  action: 'revise';
  reason: string;
  retry: {
    instruction: string;
    idempotencyKey: string;
    maxAttempts: 2;
  };
};

type RunState = {
  anchors: string[];
  revisionAttempts: number;
};

const DEFAULT_MAX_TRACKED_RUNS = 128;
const MAX_ANCHORS_PER_RUN = 6;
const MAX_ANCHOR_LENGTH = 180;
const MAX_SUSPICIOUS_REPLY_LENGTH = 600;
const MAX_REVISION_ATTEMPTS = 2;

const PROGRESS_VERBS =
  '(?:open(?:ing)?|read(?:ing)?|load(?:ing)?|check(?:ing)?|inspect(?:ing)?|fetch(?:ing)?|pull(?:ing)?\\s+up|paste|display|show|print)';
const PROGRESS_ONLY = new RegExp(
  `^(?:(?:okay|sure)[,!.]?\\s*)?(?:(?:i(?:'ll| will|'m| am)|let me)\\s+)?${PROGRESS_VERBS}\\b[\\s\\S]*[.!…]*$`,
  'i'
);
const EMPTY_DELIVERY_CLAIM =
  /\b(?:displayed|shown|pasted|printed)\s+(?:inline|below|above)\b/i;

function nonEmptyError(error: string | undefined): boolean {
  return typeof error === 'string' && error.trim().length > 0;
}

function toolResultIsError(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const details = (result as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return false;
  const record = details as { status?: unknown; error?: unknown };
  return record.status === 'error' || Boolean(record.error);
}

function resultText(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((block) => {
      if (!block || typeof block !== 'object') return [];
      const text = (block as { text?: unknown }).text;
      return typeof text === 'string' ? [text] : [];
    })
    .join('\n');
}

function normalizeForComparison(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function contentAnchors(text: string): string[] {
  const candidates = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[→|:]\s?/, '').trim())
    .filter(
      (line) =>
        line.length >= 8 && !/^\[(?:showing|reading|truncated)\b/i.test(line)
    );
  const selected = [
    candidates[0],
    candidates[1],
    candidates[Math.floor(candidates.length / 2)],
    candidates.at(-2),
    candidates.at(-1),
  ];
  return Array.from(
    new Set(
      selected
        .filter((line): line is string => Boolean(line))
        .map((line) => normalizeForComparison(line.slice(0, MAX_ANCHOR_LENGTH)))
        .filter(Boolean)
    )
  ).slice(0, MAX_ANCHORS_PER_RUN);
}

function containsReadContent(reply: string, anchors: string[]): boolean {
  const normalizedReply = normalizeForComparison(reply);
  return anchors.some((anchor) => normalizedReply.includes(anchor));
}

export function isIncompleteFileDeliveryReply(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed || trimmed.length > MAX_SUSPICIOUS_REPLY_LENGTH) return false;
  const normalized = trimmed.replace(/[’‘]/g, "'");
  return (
    PROGRESS_ONLY.test(normalized) || EMPTY_DELIVERY_CLAIM.test(normalized)
  );
}

export function createFileReadCompletionGuard(options?: {
  maxTrackedRuns?: number;
}) {
  const maxTrackedRuns = Math.max(
    1,
    options?.maxTrackedRuns ?? DEFAULT_MAX_TRACKED_RUNS
  );
  const runs = new Map<string, RunState>();

  function touch(runId: string, state: RunState): void {
    runs.delete(runId);
    runs.set(runId, state);
    while (runs.size > maxTrackedRuns) {
      const oldest = runs.keys().next().value;
      if (typeof oldest !== 'string') break;
      runs.delete(oldest);
    }
  }

  return {
    recordToolResult(input: FileReadToolResult): void {
      const runId = input.runId?.trim();
      if (!runId || input.toolName !== 'read' || nonEmptyError(input.error)) {
        return;
      }
      if (toolResultIsError(input.result)) return;
      const text = resultText(input.result);
      if (!text.trim()) return;

      const existing = runs.get(runId);
      const anchors = Array.from(
        new Set([...(existing?.anchors ?? []), ...contentAnchors(text)])
      ).slice(0, MAX_ANCHORS_PER_RUN);
      touch(runId, {
        anchors,
        revisionAttempts: existing?.revisionAttempts ?? 0,
      });
    },

    beforeFinalize(input: FileReadFinalizeInput): FileReadRevision | null {
      const runId = input.runId?.trim();
      const reply = input.lastAssistantMessage;
      if (!runId || !reply) return null;
      const state = runs.get(runId);
      if (!state || state.revisionAttempts >= MAX_REVISION_ATTEMPTS)
        return null;
      if (
        containsReadContent(reply, state.anchors) ||
        !isIncompleteFileDeliveryReply(reply)
      ) {
        return null;
      }

      const attempt = state.revisionAttempts + 1;
      touch(runId, { ...state, revisionAttempts: attempt });
      return {
        action: 'revise',
        reason: 'successful file read was not delivered in the draft reply',
        retry: {
          instruction:
            attempt === 1
              ? 'A read tool already succeeded in this turn, but your draft only announces or claims delivery without including the requested file contents. Replace the draft with a final answer that actually contains the requested contents from the existing read result. Do not call read again and do not send another progress update. If the contents truly cannot be delivered, state the concrete limitation instead of claiming they were shown.'
              : 'Your correction was still only a progress update or an empty delivery claim. This is the final correction attempt: answer with the requested contents already present in the successful read result. Do not repeat the progress sentence, do not call read again, and do not claim the contents are shown unless they are visibly included. If delivery is impossible, state the concrete limitation.',
          idempotencyKey: `tlon:file-read-completion:${runId}:${attempt}`,
          maxAttempts: MAX_REVISION_ATTEMPTS,
        },
      };
    },

    clear(runId: string | undefined): void {
      const key = runId?.trim();
      if (key) runs.delete(key);
    },

    trackedRunCount(): number {
      return runs.size;
    },
  };
}
