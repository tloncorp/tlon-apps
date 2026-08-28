export type FileReadToolResult = {
  runId?: string;
  toolName: string;
  params?: unknown;
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
  failed: boolean;
  revisionAttempts: number;
  truncated: boolean;
  truncatedTargets: string[];
  unknownTruncation: boolean;
};

const DEFAULT_MAX_TRACKED_RUNS = 128;
const MAX_ANCHORS_PER_RUN = 12;
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
  /\b(?:found|contains?|confirms?|had|has|showed|shows|revealed|reveals|indicated|indicates|peak(?:ed|s)?|average[ds]?)\b|\b(?:there|it|they|this|that|which)\s+(?:is|are|was|were|has|have|had|can|could|will|would|shows?|contains?|confirms?)\b/i;
const TRUNCATION_MARKER =
  /^\s*\[(?:(?:showing|reading)\s+lines?\s+\d+\s*[-–—]\s*\d+\s+of\s+\d+(?:[^\]]*)|truncated\s+output(?:[^\]]*\b\d+\b[^\]]*)?)\]\s*$/im;

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
    candidates[0]?.length > MAX_ANCHOR_LENGTH
      ? candidates[0].slice(-MAX_ANCHOR_LENGTH)
      : undefined,
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

function readTarget(params: unknown): string | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return null;
  }
  const record = params as { path?: unknown; file_path?: unknown };
  const value =
    typeof record.path === 'string'
      ? record.path
      : typeof record.file_path === 'string'
        ? record.file_path
        : null;
  return value?.trim() || null;
}

function isDeferredSameLineTail(tail: string): boolean {
  return /^(?:see|shown?|pasted?|printed?|displayed?)\b[^\n]{0,80}\b(?:below|above|next|soon)\b[.!…]*$|^(?:i(?:'ll| will)|let me)\b[^\n]{0,100}\b(?:below|above|next|soon)\b[.!…]*$/i.test(
    tail
  );
}

function unwrapProgressMarkdown(reply: string): string {
  let value = reply.replace(/^\s*(?:>\s*|[-+*]\s+|\d+[.)]\s+)/, '').trim();
  const emphasis = value.match(/^(?:\*\*|__)([\s\S]*)(?:\*\*|__)$/);
  if (emphasis?.[1]) value = emphasis[1].trim();
  return value;
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
    ?.replace(/^[\s:;,.!\-–—`*_~]+/, '')
    .trim();
  if (sameLineTail && !isDeferredSameLineTail(sameLineTail)) return false;

  const visiblePayloadLines = reply
    .slice((claim.index ?? 0) + claim[0].length)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s:;,.!\-–—`*_~]+/, '').trim())
    .filter(
      (line) =>
        Boolean(line) && !/^```/.test(line) && !isDeferredSameLineTail(line)
    );

  // Only content after the delivery claim can fulfill it. Introductory prose
  // before an empty heading is not delivered output.
  return visiblePayloadLines.length === 0;
}

export function isIncompleteFileDeliveryReply(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) return true;
  if (trimmed.length > MAX_SUSPICIOUS_REPLY_LENGTH) return false;
  const normalized = trimmed.replace(/[’‘]/g, "'");
  if (/^NO_REPLY$/i.test(normalized)) return true;
  const progressCandidate = unwrapProgressMarkdown(normalized);
  return (
    (PROGRESS_ONLY.test(progressCandidate) &&
      !SUBSTANTIVE_PROGRESS_TAIL.test(progressCandidate)) ||
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
  const failedRuns = new Set<string>();

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
        // A failure for any read target makes a global completion correction
        // unsafe. Keep that fact sticky so an unrelated later success cannot
        // make us tell the model not to retry the failed read.
        runs.delete(runId);
        failedRuns.delete(runId);
        failedRuns.add(runId);
        while (failedRuns.size > maxTrackedRuns) {
          const oldest = failedRuns.values().next().value;
          if (typeof oldest !== 'string') break;
          failedRuns.delete(oldest);
        }
        return;
      }
      const text = resultText(input.result);

      const existing = runs.get(runId);
      const anchors = Array.from(
        new Set([...contentAnchors(text), ...(existing?.anchors ?? [])])
      ).slice(0, MAX_ANCHORS_PER_RUN);
      const target = readTarget(input.params);
      const resultWasTruncated = TRUNCATION_MARKER.test(text);
      const truncatedTargets = new Set(existing?.truncatedTargets ?? []);
      let unknownTruncation = existing?.unknownTruncation ?? false;
      if (resultWasTruncated) {
        if (target) truncatedTargets.add(target);
        else unknownTruncation = true;
      } else if (target) {
        // A marker-free follow-up for the same path reached the remainder.
        // Reads of another path do not clear this target's outstanding state.
        truncatedTargets.delete(target);
      }
      touch(runId, {
        anchors,
        empty: anchors.length === 0 && !text.trim(),
        failed: failedRuns.has(runId) || (existing?.failed ?? false),
        revisionAttempts: existing?.revisionAttempts ?? 0,
        truncated: unknownTruncation || truncatedTargets.size > 0,
        truncatedTargets: [...truncatedTargets],
        unknownTruncation,
      });
    },

    beforeFinalize(input: FileReadFinalizeInput): FileReadRevision | null {
      const runId = input.runId?.trim();
      const reply = input.lastAssistantMessage ?? '';
      if (!runId) return null;
      const state = runs.get(runId);
      if (
        !state ||
        state.failed ||
        state.revisionAttempts >= MAX_REVISION_ATTEMPTS
      )
        return null;
      if (
        !state.truncated &&
        (containsRepresentativeReadContent(reply, state.anchors) ||
          (!isIncompleteFileDeliveryReply(reply) &&
            !(
              EMPTY_DELIVERY_CLAIM.test(reply) &&
              matchedReadContentCount(reply, state.anchors) > 0
            )))
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
      if (key) {
        runs.delete(key);
        failedRuns.delete(key);
      }
    },

    trackedRunCount(): number {
      return runs.size;
    },
  };
}
