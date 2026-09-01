import { posix as path } from 'node:path';

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

type ReadTargetState = {
  anchors: string[];
  empty: boolean;
  failed: boolean;
  lastOffset: number;
  nextOffset: number | null;
  truncated: boolean;
};

type RunState = {
  lastSuccessfulTarget: string | null;
  revisionAttempts: number;
  targets: Map<string, ReadTargetState>;
};

const DEFAULT_MAX_TRACKED_RUNS = 128;
const MAX_ANCHORS_PER_RUN = 12;
const MAX_ANCHOR_LENGTH = 180;
const MAX_SUSPICIOUS_REPLY_LENGTH = 600;
const MAX_REVISION_ATTEMPTS = 2;
const UNKNOWN_TARGET = '\0unknown-read-target';

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

function nextOffsetFromTruncationMarker(text: string): number | null {
  const match =
    /^\s*\[(?:showing|reading)\s+lines?\s+\d+\s*[-–—]\s*(\d+)\s+of\s+\d+(?:[^\]]*)\]\s*$/im.exec(
      text
    );
  if (!match?.[1]) return null;
  const lastShownLine = Number(match[1]);
  return Number.isSafeInteger(lastShownLine) ? lastShownLine + 1 : null;
}

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
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return path.normalize(trimmed.replace(/\\/g, '/'));
}

function readOffset(params: unknown): number {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return 0;
  const offset = (params as { offset?: unknown }).offset;
  return typeof offset === 'number' && Number.isFinite(offset) && offset >= 0
    ? offset
    : 0;
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

function hasFailedTarget(state: RunState): boolean {
  return [...state.targets.values()].some((target) => target.failed);
}

function hasTruncatedTarget(state: RunState): boolean {
  return [...state.targets.values()].some((target) => target.truncated);
}

function allSuccessfulTargetsAreEmpty(state: RunState): boolean {
  const targets = [...state.targets.values()].filter(
    (target) => !target.failed
  );
  return targets.length > 0 && targets.every((target) => target.empty);
}

function allTargetContentIsRepresented(
  reply: string,
  state: RunState
): boolean {
  const successfulTargets = [...state.targets.entries()].filter(
    ([, target]) => !target.failed
  );
  const normalizedReply = normalizeForComparison(reply);
  const emptyResultIsAcknowledged =
    /\b(?:empty|0 bytes|contains? no (?:content|data|text))\b/i.test(reply);
  const relevantTargetKeys = new Set<string>();
  if (state.lastSuccessfulTarget) {
    relevantTargetKeys.add(state.lastSuccessfulTarget);
  }
  for (const [targetKey, target] of successfulTargets) {
    const targetName = targetKey.split('/').at(-1) ?? targetKey;
    if (
      (targetKey !== UNKNOWN_TARGET &&
        normalizedReply.includes(normalizeForComparison(targetName))) ||
      matchedReadContentCount(reply, target.anchors) > 0
    ) {
      relevantTargetKeys.add(targetKey);
    }
  }
  const targets = successfulTargets.filter(([targetKey]) =>
    relevantTargetKeys.has(targetKey)
  );
  return (
    targets.length > 0 &&
    targets.every(([targetKey, target]) => {
      if (!target.empty) {
        return containsRepresentativeReadContent(reply, target.anchors);
      }
      if (!emptyResultIsAcknowledged) return false;
      if (targets.length === 1 || targetKey === UNKNOWN_TARGET) return true;
      const targetName = targetKey.split(/[\\/]/).at(-1) ?? targetKey;
      return normalizedReply.includes(normalizeForComparison(targetName));
    })
  );
}

function anyTargetContentIsRepresented(
  reply: string,
  state: RunState
): boolean {
  return [...state.targets.values()].some(
    (target) =>
      !target.failed && matchedReadContentCount(reply, target.anchors) > 0
  );
}

function revisionInstruction(state: RunState, attempt: number): string {
  const finalAttempt =
    attempt === MAX_REVISION_ATTEMPTS
      ? ' This is the final correction attempt.'
      : '';
  if (hasTruncatedTarget(state)) {
    return `A read tool returned only part of the requested file, and your draft did not complete the original request.${finalAttempt} Continue reading from the appropriate offset as needed, then answer the user's original request using the complete result. Preserve any requested summary, transformation, or privacy constraint; do not dump raw contents unless the user asked for them. Do not send another progress-only update or claim delivery without visible output.`;
  }
  if (allSuccessfulTargetsAreEmpty(state)) {
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
        const existing = runs.get(runId);
        const targets = new Map(existing?.targets ?? []);
        const targetKey = readTarget(input.params) ?? UNKNOWN_TARGET;
        const target = targets.get(targetKey);
        targets.set(targetKey, {
          anchors: target?.anchors ?? [],
          empty: target?.empty ?? false,
          failed: true,
          // Failed reads are not progress. Preserve the last successful offset
          // so a retry at the same requested continuation can still recover.
          lastOffset: target?.lastOffset ?? 0,
          nextOffset: target?.nextOffset ?? null,
          truncated: target?.truncated ?? false,
        });
        touch(runId, {
          lastSuccessfulTarget: existing?.lastSuccessfulTarget ?? null,
          revisionAttempts: existing?.revisionAttempts ?? 0,
          targets,
        });
        return;
      }
      const text = resultText(input.result);

      const existing = runs.get(runId);
      const targets = new Map(existing?.targets ?? []);
      const targetKey = readTarget(input.params) ?? UNKNOWN_TARGET;
      const existingTarget = targets.get(targetKey);
      const anchors = Array.from(
        new Set([...contentAnchors(text), ...(existingTarget?.anchors ?? [])])
      ).slice(0, MAX_ANCHORS_PER_RUN);
      const offset = readOffset(input.params);
      const resultWasTruncated = TRUNCATION_MARKER.test(text);
      const continuedFromExpectedOffset =
        existingTarget?.truncated === true &&
        (existingTarget.nextOffset !== null
          ? offset === existingTarget.nextOffset
          : offset > existingTarget.lastOffset);
      const nextOffset = resultWasTruncated
        ? existingTarget?.truncated === true && !continuedFromExpectedOffset
          ? existingTarget.nextOffset
          : nextOffsetFromTruncationMarker(text)
        : existingTarget?.truncated === true && !continuedFromExpectedOffset
          ? existingTarget.nextOffset
          : null;
      targets.set(targetKey, {
        anchors,
        empty:
          (existingTarget?.empty ?? true) &&
          anchors.length === 0 &&
          !text.trim(),
        // A successful retry resolves only this target's prior failure. Other
        // target failures remain outstanding and keep correction suppressed.
        failed:
          targetKey === UNKNOWN_TARGET && existingTarget?.failed === true
            ? true
            : false,
        lastOffset: Math.max(existingTarget?.lastOffset ?? 0, offset),
        nextOffset,
        // A marker-free reread at the same offset is not proof that the caller
        // continued to EOF. A ranged marker additionally requires the exact
        // next offset, so skipped chunks cannot clear truncation.
        truncated:
          resultWasTruncated ||
          (existingTarget?.truncated === true && !continuedFromExpectedOffset),
      });
      touch(runId, {
        lastSuccessfulTarget: targetKey,
        revisionAttempts: existing?.revisionAttempts ?? 0,
        targets,
      });
    },

    beforeFinalize(input: FileReadFinalizeInput): FileReadRevision | null {
      const runId = input.runId?.trim();
      const reply = input.lastAssistantMessage ?? '';
      if (!runId) return null;
      const state = runs.get(runId);
      if (
        !state ||
        hasFailedTarget(state) ||
        state.revisionAttempts >= MAX_REVISION_ATTEMPTS
      )
        return null;
      if (
        !hasTruncatedTarget(state) &&
        (allTargetContentIsRepresented(reply, state) ||
          (!isIncompleteFileDeliveryReply(reply) &&
            !(
              EMPTY_DELIVERY_CLAIM.test(reply) &&
              anyTargetContentIsRepresented(reply, state)
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
      }
    },

    trackedRunCount(): number {
      return runs.size;
    },
  };
}
