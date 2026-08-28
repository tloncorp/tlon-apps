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
  empty: boolean;
  revisionAttempts: number;
  truncated: boolean;
};

const DEFAULT_MAX_TRACKED_RUNS = 128;
const MAX_ANCHORS_PER_RUN = 6;
const MAX_ANCHOR_LENGTH = 180;
const MAX_SUSPICIOUS_REPLY_LENGTH = 600;
const MAX_REVISION_ATTEMPTS = 2;

const PROGRESS_VERBS =
  '(?:open(?:ing)?|read(?:ing)?|load(?:ing)?|check(?:ing)?|inspect(?:ing)?|fetch(?:ing)?|pull(?:ing)?\\s+up|past(?:e|ing)|display(?:ing)?|show(?:ing)?|print(?:ing)?)';
const PROGRESS_MODIFIERS = '(?:(?:going\\s+to|now|go\\s+ahead\\s+and)\\s+)?';
const PROGRESS_ONLY = new RegExp(
  `^(?:(?:okay|sure)[,!.]?\\s*)?(?:(?:i(?:'ll| will|'m| am)|let me)\\s+)?${PROGRESS_MODIFIERS}${PROGRESS_VERBS}\\b[^,;:\\n]{0,220}[.!…]*$`,
  'i'
);
const EMPTY_DELIVERY_CLAIM =
  /(?:\b(?:displayed|shown|pasted|printed)\s+(?:inline|below|above)\b|\b(?:here\s+(?:are|is)\s+(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents?|(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents?\s+(?:are|is)\s+(?:below|above|here))\b)/i;
const SUBSTANTIVE_PROGRESS_TAIL =
  /\b(?:found|contains?|had|has|showed|shows|revealed|reveals|indicated|indicates|peak(?:ed|s)?|average[ds]?)\b/i;
const TRUNCATION_MARKER = /^\s*\[(?:showing|reading|truncated)\b/im;

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

function resultHasNonTextContent(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return false;
  return content.some(
    (block) =>
      block != null &&
      typeof block === 'object' &&
      (block as { type?: unknown }).type !== 'text'
  );
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
    .filter((line) => line.length > 0 && !TRUNCATION_MARKER.test(line));
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

function matchedReadContentCount(reply: string, anchors: string[]): number {
  if (anchors.length === 0) return 0;
  const normalizedReply = normalizeForComparison(reply);
  const replyLines = new Set(
    reply
      .split(/\r?\n/)
      .map((line) => normalizeForComparison(line))
      .filter(Boolean)
  );
  return anchors.filter((anchor) =>
    anchor.length < 8
      ? replyLines.has(anchor)
      : normalizedReply.includes(anchor)
  ).length;
}

function containsRepresentativeReadContent(
  reply: string,
  anchors: string[]
): boolean {
  if (anchors.length === 0) return false;
  return matchedReadContentCount(reply, anchors) >= Math.min(3, anchors.length);
}

function isEmptyDeliveryClaim(reply: string): boolean {
  const claim = EMPTY_DELIVERY_CLAIM.exec(reply);
  if (!claim) return false;

  // A heading and its transformed payload may share one line. Only treat the
  // claim as empty when nothing visible follows the matched claim.
  const sameLineTail = reply
    .slice((claim.index ?? 0) + claim[0].length)
    .split(/\r?\n/, 1)[0]
    ?.replace(/^[\s:;,.!\-–—`]+/, '')
    .trim();
  if (sameLineTail) return false;

  const nonEmptyLines = reply
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (nonEmptyLines.length <= 1) return true;

  // A claim used as a heading is fine when visible output follows it. This is
  // important for transformed output, which need not contain source anchors.
  return nonEmptyLines.every(
    (line) => EMPTY_DELIVERY_CLAIM.test(line) || /^```/.test(line)
  );
}

export function isIncompleteFileDeliveryReply(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed || trimmed.length > MAX_SUSPICIOUS_REPLY_LENGTH) return false;
  const normalized = trimmed.replace(/[’‘]/g, "'");
  return (
    (PROGRESS_ONLY.test(normalized) &&
      !SUBSTANTIVE_PROGRESS_TAIL.test(normalized)) ||
    isEmptyDeliveryClaim(normalized)
  );
}

function revisionInstruction(state: RunState, attempt: number): string {
  const finalAttempt =
    attempt === MAX_REVISION_ATTEMPTS
      ? ' This is the final correction attempt.'
      : '';
  if (state.truncated) {
    return `A read tool returned only part of the requested file, and your draft did not complete the original request.${finalAttempt} Continue reading from the appropriate offset as needed, then answer the user's original request using the complete result. Preserve any requested summary, transformation, or privacy constraint; do not dump raw contents unless the user asked for them. Do not send another progress-only update or claim delivery without visible output.`;
  }
  if (state.empty) {
    return `A read tool successfully returned an empty file, but your draft only announces work or claims delivery.${finalAttempt} Replace it with a final answer that plainly says the file is empty and responds to the user's original request. Do not call read again or send another progress update.`;
  }
  return `A read tool already succeeded in this turn, but your draft only announces work or claims delivery without completing the user's original request.${finalAttempt} Replace the draft with a final answer based on the existing read result. If the user asked to see the contents, include them; if they asked for a summary, transformation, or inspection, perform that instead. Preserve any privacy or formatting constraint. Do not call read again, send another progress update, or claim output is visible when it is not. If the request truly cannot be completed, state the concrete limitation.`;
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
      if (!runId || input.toolName !== 'read') {
        return;
      }
      if (
        nonEmptyError(input.error) ||
        toolResultIsError(input.result) ||
        resultHasNonTextContent(input.result)
      ) {
        // A later failure or an opaque result means we can no longer prove the
        // user's requested read succeeded. Suppress correction for this run.
        runs.delete(runId);
        return;
      }
      const text = resultText(input.result);

      const existing = runs.get(runId);
      const anchors = Array.from(
        new Set([...(existing?.anchors ?? []), ...contentAnchors(text)])
      ).slice(0, MAX_ANCHORS_PER_RUN);
      touch(runId, {
        anchors,
        empty: anchors.length === 0 && !text.trim(),
        revisionAttempts: existing?.revisionAttempts ?? 0,
        truncated: Boolean(existing?.truncated) || TRUNCATION_MARKER.test(text),
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
        containsRepresentativeReadContent(reply, state.anchors) ||
        (!isIncompleteFileDeliveryReply(reply) &&
          !(
            EMPTY_DELIVERY_CLAIM.test(reply) &&
            matchedReadContentCount(reply, state.anchors) > 0
          ))
      ) {
        return null;
      }

      const attempt = state.revisionAttempts + 1;
      touch(runId, { ...state, revisionAttempts: attempt });
      return {
        action: 'revise',
        reason: 'successful file read was not delivered in the draft reply',
        retry: {
          instruction: revisionInstruction(state, attempt),
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
