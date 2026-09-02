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
  messages?: unknown[];
  sessionKey?: string;
};

export type FileReadMessageDelivery = {
  content?: string;
  runId?: string;
  sessionKey?: string;
  success: boolean;
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
  anchorGroups: string[][];
  anchors: string[];
  bounded: boolean;
  empty: boolean;
  failed: boolean;
  lastOffset: number;
  nextOffset: number | null;
  truncated: boolean;
};

type RunState = {
  messageDelivery: { content: string; sessionKey: string } | null;
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
const FILE_MUTATION_TOOLS = new Set([
  'apply_patch',
  'edit',
  'edit_file',
  'write',
  'write_file',
]);

const PROGRESS_VERBS =
  '(?:open(?:ing)?|read(?:ing)?|load(?:ing)?|check(?:ing)?|inspect(?:ing)?|fetch(?:ing)?|analyz(?:e|ing)|summari[sz](?:e|ing)|review(?:ing)?|process(?:ing)?|pars(?:e|ing)|scan(?:ning)?|pull(?:ing)?\\s+up|past(?:e|ing)|display(?:ing)?|show(?:ing)?|print(?:ing)?)';
const PROGRESS_MODIFIERS = '(?:(?:going\\s+to|now|go\\s+ahead\\s+and)\\s+)?';
const PROGRESS_ADVERBS =
  '(?:(?:currently|quickly|briefly|carefully|first|just|now|still)\\s+)?';
const PROGRESS_SUBJECT = "(?:(?:i(?:'ll| will|'m| am)|let me)\\s+)?";
const PROGRESS_CLAUSE = `${PROGRESS_SUBJECT}${PROGRESS_ADVERBS}${PROGRESS_MODIFIERS}${PROGRESS_VERBS}\\b[^,;:\\n]{0,220}`;
const PROGRESS_ONLY = new RegExp(
  `^(?:(?:okay|sure)[,!.]?\\s*)?${PROGRESS_CLAUSE}(?:[,;:]\\s*(?:(?:(?:and\\s+)?then|and)\\s+)?${PROGRESS_CLAUSE})*[.!…]*$`,
  'i'
);
const COMPLETION_PREFIX =
  /^(?:(?:i(?:'ve| have)\s+(?:(?:finished|completed)\s+)?read(?:ing)?|i\s+(?:finished|completed)\s+reading|(?:i(?:'m| am)\s+)?done\s+reading)|(?:the\s+)?file\s+(?:has\s+been|was)\s+read)\b/i;
const EMPTY_DELIVERY_CLAIM =
  /(?:\b(?:displayed|shown|pasted|printed)\s+(?:inline|below|above)\b|\b(?:here\s+(?:are|is)\s+(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents?|(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents?\s+(?:are|is)\s+(?:below|above|here))\b)/i;
const FULL_FILE_DELIVERY_CLAIM =
  /\b(?:here\s+(?:are|is)\s+(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents|(?:the\s+)?(?:requested\s+)?(?:file\s+)?contents\s+(?:are|is)\s+(?:below|above|here)|(?:the\s+)?(?:complete|full|entire)\s+file\s+(?:(?:is|was)\s+)?(?:displayed|shown|pasted|printed)\s+(?:inline|below|above))\b/i;
const EXPLICIT_FULL_FILE_DELIVERY_CLAIM =
  /\b(?:the\s+)?(?:complete|full|entire)\s+file\s+(?:(?:is|was)\s+)?(?:displayed|shown|pasted|printed)\s+(?:inline|below|above)\b/i;
const EMPTY_RESULT_ACKNOWLEDGMENT =
  /\b(?:(?:an?\s+)?empty\s+file|0[- ]?bytes?|(?:file|it|this|that|[\w.-]+)\s+(?:(?:is|was|are|were)\s+empty|(?:has|had)\s+no\s+(?:content|data|text))|contains?\s+no\s+(?:content|data|text)|there\s+(?:is|was)\s+no\s+(?:content|data|text)(?:\s+(?:in|inside)\s+(?:the\s+)?(?:file|it))?)\b/i;
const STANDALONE_COMPLETION = /^(?:done|finished|complete(?:d)?)[.!…]*$/i;
const SUBSTANTIVE_PROGRESS_TAIL =
  /\b(?:found|contains?|confirms?|had|has|showed|shows|revealed|reveals|indicated|indicates|peak(?:ed|s)?|average[ds]?)\b|\b(?:there|it|they|this|that|which)\s+(?:is|are|was|were|has|have|had|can|could|will|would|shows?|contains?|confirms?)\b/i;
const GERUND_RESULT_SUBJECT =
  /^(?:opening|reading|loading|checking|inspecting|fetching|analyzing|summari[sz]ing|reviewing|processing|parsing|scanning|pasting|displaying|showing|printing)\b(?:\s+[\p{L}\p{N}_.-]+){0,5}\s+(?:is|are|was|were|has|have|had|took|takes|will|would|can|could)\b/iu;
const GERUND_PROGRESS_STATE =
  /^(?:opening|reading|loading|checking|inspecting|fetching|analyzing|summari[sz]ing|reviewing|processing|parsing|scanning|pasting|displaying|showing|printing)\b(?:\s+[\p{L}\p{N}_.-]+){0,5}\s+(?:is|are|was|were|will\s+be|would\s+be)\s+(?:underway|pending|next|ongoing|in\s+progress|not\s+yet\s+(?:done|complete)|still\s+(?:running|happening))\b/iu;
const DEFERRED_COMPLETION_TAIL =
  /\b(?:will|would|going\s+to)\b[^.!?\n]{0,100}\b(?:next|soon|later|shortly|afterward)\b/i;
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

function lastUserRequest(messages: unknown[] | undefined): string {
  if (!messages) return '';
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      continue;
    }
    const record = message as { role?: unknown; content?: unknown };
    if (record.role !== 'user') continue;
    if (typeof record.content === 'string') return record.content;
    if (!Array.isArray(record.content)) return '';
    return record.content
      .flatMap((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
          return [];
        }
        const text = (block as { text?: unknown }).text;
        return typeof text === 'string' ? [text] : [];
      })
      .join('\n');
  }
  return '';
}

function requestsBoundedFileRange(request: string): boolean {
  if (!request.trim()) return false;
  if (
    /\b(?:complete|full|entire|whole)\s+(?:file|contents?)\b/i.test(request)
  ) {
    return false;
  }
  const count =
    '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a\\s+few|several)';
  return (
    new RegExp(
      `\\b(?:first|last|top|bottom)\\s+${count}\\s+lines?\\b`,
      'i'
    ).test(request) ||
    /\blines?\s+\d+\s*(?:[-–—]|through|to)\s*\d+\b/i.test(request) ||
    /\b(?:an?\s+)?(?:excerpt|snippet)\b/i.test(request)
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

function containsDelimitedReference(value: string, reference: string): boolean {
  if (!reference) return false;
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}._/-])${escaped}(?=$|[^\\p{L}\\p{N}._/-])`,
    'u'
  ).test(value);
}

function replaceDelimitedReference(
  value: string,
  reference: string,
  replacement: string
): string {
  if (!reference) return value;
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const referenceChars = reference.includes('/')
    ? '\\p{L}\\p{N}._/-'
    : '\\p{L}\\p{N}._-';
  return value.replace(
    new RegExp(
      `(^|[^${referenceChars}])${escaped}(?=$|[^${referenceChars}])`,
      'gu'
    ),
    (_match, prefix: string) => `${prefix}${replacement}`
  );
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

function mutationTargets(toolName: string, params: unknown): string[] | null {
  const directTarget = readTarget(params);
  if (directTarget) return [directTarget];
  if (toolName !== 'apply_patch') return null;

  const patchText =
    typeof params === 'string'
      ? params
      : params && typeof params === 'object' && !Array.isArray(params)
        ? Object.values(params as Record<string, unknown>).find(
            (value): value is string =>
              typeof value === 'string' && value.includes('*** Begin Patch')
          )
        : null;
  if (!patchText) return null;

  const targets = Array.from(
    patchText.matchAll(/^\*\*\* (?:(?:Update|Delete) File:|Move to:) (.+)$/gm),
    (match) => path.normalize(match[1]!.trim().replace(/\\/g, '/'))
  );
  return targets.length > 0 ? Array.from(new Set(targets)) : null;
}

function targetKeysMayMatch(left: string, right: string): boolean {
  if (left === right) return true;
  if (left === UNKNOWN_TARGET || right === UNKNOWN_TARGET) return false;
  return left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function readOffset(params: unknown): number {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return 0;
  const offset = (params as { offset?: unknown }).offset;
  return typeof offset === 'number' && Number.isFinite(offset) && offset >= 0
    ? offset
    : 0;
}

function readIsExplicitlyBounded(params: unknown): boolean {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return false;
  }
  const limit = (params as { limit?: unknown }).limit;
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
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
    .map((line) => {
      const trimmed = line.trim();
      if (/^(?:```|~~~)[\w.+-]*\s*$/.test(trimmed)) return '';
      return line.replace(/^[\s:;,.!\-–—`*_~]+/, '').trim();
    })
    .filter((line) => Boolean(line) && !isDeferredSameLineTail(line));

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
  const completionPrefix = COMPLETION_PREFIX.exec(progressCandidate);
  const completionTail = completionPrefix
    ? progressCandidate.slice(completionPrefix[0].length)
    : '';
  const laterSentences = completionTail
    .split(
      /(?:[.!?]\s+|[,;:]\s*(?:and\s+)?|\s+and\s+(?=(?:the|this|that|it|they|there)\b))/i
    )
    .slice(1)
    .map((sentence) => unwrapProgressMarkdown(sentence))
    .filter(Boolean);
  const hasVisibleResultSentence = laterSentences.some((sentence) => {
    const wordCount = sentence.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
    return (
      wordCount >= 3 &&
      !PROGRESS_ONLY.test(sentence) &&
      !COMPLETION_PREFIX.test(sentence) &&
      !DEFERRED_COMPLETION_TAIL.test(sentence) &&
      !isEmptyDeliveryClaim(sentence)
    );
  });
  const completionOnly =
    completionPrefix != null &&
    (!SUBSTANTIVE_PROGRESS_TAIL.test(completionTail) ||
      DEFERRED_COMPLETION_TAIL.test(completionTail)) &&
    !hasVisibleResultSentence;
  return (
    (PROGRESS_ONLY.test(progressCandidate) &&
      !SUBSTANTIVE_PROGRESS_TAIL.test(progressCandidate) &&
      (!GERUND_RESULT_SUBJECT.test(progressCandidate) ||
        GERUND_PROGRESS_STATE.test(progressCandidate))) ||
    completionOnly ||
    STANDALONE_COMPLETION.test(progressCandidate) ||
    isEmptyDeliveryClaim(normalized)
  );
}

type TrackedTarget = [string, ReadTargetState];

function targetBasenameCounts(targets: TrackedTarget[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [targetKey] of targets) {
    if (targetKey === UNKNOWN_TARGET) continue;
    const targetName = targetKey.split('/').at(-1) ?? targetKey;
    const normalizedTargetName = normalizeForComparison(targetName);
    counts.set(
      normalizedTargetName,
      (counts.get(normalizedTargetName) ?? 0) + 1
    );
  }
  return counts;
}

function targetIsNamed(
  normalizedReply: string,
  targetKey: string,
  basenameCounts: Map<string, number>
): boolean {
  if (targetKey === UNKNOWN_TARGET) return false;
  const targetName = targetKey.split('/').at(-1) ?? targetKey;
  const normalizedTargetName = normalizeForComparison(targetName);
  return (
    containsDelimitedReference(
      normalizedReply,
      normalizeForComparison(targetKey)
    ) ||
    ((basenameCounts.get(normalizedTargetName) ?? 0) === 1 &&
      containsDelimitedReference(normalizedReply, normalizedTargetName))
  );
}

function hasRelevantFailedTarget(reply: string, state: RunState): boolean {
  const targets = [...state.targets.entries()];
  const failedTargets = targets.filter(([, target]) => target.failed);
  if (failedTargets.length === 0) return false;
  if (!targets.some(([, target]) => !target.failed)) return true;
  if (failedTargets.some(([targetKey]) => targetKey === UNKNOWN_TARGET)) {
    return true;
  }
  if (/\b(?:failed|could\s+not|couldn't|unable\s+to)\b/i.test(reply)) {
    return true;
  }
  const normalizedReply = normalizeForComparison(reply);
  const basenameCounts = targetBasenameCounts(targets);
  return failedTargets.some(
    ([targetKey, target]) =>
      targetIsNamed(normalizedReply, targetKey, basenameCounts) ||
      containsRepresentativeReadContent(reply, target.anchors)
  );
}

function hasTruncatedTarget(targets: TrackedTarget[]): boolean {
  return targets.some(([, target]) => target.truncated);
}

function allTargetsAreEmpty(targets: TrackedTarget[]): boolean {
  return targets.length > 0 && targets.every(([, target]) => target.empty);
}

function claimsNonEmptyTargetIsEmpty(
  reply: string,
  targets: TrackedTarget[]
): boolean {
  const nonEmptyTargets = targets.filter(([, target]) => !target.empty);
  if (nonEmptyTargets.length === 0) return false;
  if (targets.length === 1) return EMPTY_RESULT_ACKNOWLEDGMENT.test(reply);

  const normalizedReply = normalizeForComparison(reply);
  const basenameCounts = targetBasenameCounts(targets);
  return normalizedReply
    .split(/[;.!?\n]+/)
    .some(
      (clause) =>
        EMPTY_RESULT_ACKNOWLEDGMENT.test(clause) &&
        nonEmptyTargets.some(([targetKey]) =>
          targetIsNamed(clause, targetKey, basenameCounts)
        )
    );
}

function relevantTargets(reply: string, state: RunState): TrackedTarget[] {
  const successfulTargets = [...state.targets.entries()].filter(
    ([, target]) => !target.failed
  );
  const normalizedReply = normalizeForComparison(reply);
  const basenameCounts = targetBasenameCounts(successfulTargets);
  const relevantTargetKeys = new Set<string>();
  for (const [targetKey, target] of successfulTargets) {
    if (
      targetIsNamed(normalizedReply, targetKey, basenameCounts) ||
      containsRepresentativeReadContent(reply, target.anchors)
    ) {
      relevantTargetKeys.add(targetKey);
    }
  }
  if (relevantTargetKeys.size === 0 && state.lastSuccessfulTarget) {
    relevantTargetKeys.add(state.lastSuccessfulTarget);
  }
  const targets = successfulTargets.filter(([targetKey]) =>
    relevantTargetKeys.has(targetKey)
  );
  return targets;
}

function acknowledgedEmptyTargetKeys(
  reply: string,
  targets: TrackedTarget[]
): Set<string> {
  const normalizedReply = normalizeForComparison(reply);
  const acknowledgedEmptyTargets = new Set<string>();
  const emptyTargets = targets.filter(([, target]) => target.empty);
  if (targets.length === 1 || emptyTargets[0]?.[0] === UNKNOWN_TARGET) {
    if (EMPTY_RESULT_ACKNOWLEDGMENT.test(reply) && emptyTargets[0]) {
      acknowledgedEmptyTargets.add(emptyTargets[0][0]);
    }
  } else if (emptyTargets.length > 0) {
    let replyWithPlaceholders = normalizedReply;
    const placeholders = new Map<string, string>();
    const basenameCounts = new Map<string, number>();
    for (const [targetKey] of emptyTargets) {
      const targetName = targetKey.split(/[\\/]/).at(-1) ?? targetKey;
      const normalizedTargetName = normalizeForComparison(targetName);
      basenameCounts.set(
        normalizedTargetName,
        (basenameCounts.get(normalizedTargetName) ?? 0) + 1
      );
    }
    [...emptyTargets]
      .map(([targetKey], index) => {
        const targetName = targetKey.split(/[\\/]/).at(-1) ?? targetKey;
        const normalizedTargetName = normalizeForComparison(targetName);
        const reference =
          (basenameCounts.get(normalizedTargetName) ?? 0) > 1
            ? normalizeForComparison(targetKey)
            : normalizedTargetName;
        return { index, reference, targetKey };
      })
      .sort((left, right) => right.reference.length - left.reference.length)
      .forEach(({ index, reference, targetKey }) => {
        if (targetKey === UNKNOWN_TARGET) return;
        const placeholder = `tlonemptytarget${index}`;
        placeholders.set(targetKey, placeholder);
        replyWithPlaceholders = replaceDelimitedReference(
          replyWithPlaceholders,
          reference,
          placeholder
        );
      });
    const clauses = replyWithPlaceholders.split(/[;.!?\n]+/);
    for (const [targetKey, placeholder] of placeholders) {
      if (
        clauses.some((clause) => {
          const escapedPlaceholder = placeholder.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
          );
          const directResult = new RegExp(
            `\\b${escapedPlaceholder}\\b\\s+(?:(?:is|was)\\s+empty|(?:contains?|has)\\s+0[- ]?bytes?|contains?\\s+no\\s+(?:content|data|text))\\b`,
            'i'
          );
          if (directResult.test(clause)) return true;

          const collectiveResult =
            /\b(?:are|were)\s+empty\b|\b(?:contain|have)\s+0[- ]?bytes?\b|\bcontain\s+no\s+(?:content|data|text)\b/i.exec(
              clause
            );
          if (!collectiveResult) return false;
          const subject =
            clause
              .slice(0, collectiveResult.index)
              .split(/\b(?:although|but|however|though|whereas|while|yet)\b/i)
              .at(-1) ?? '';
          return subject.includes(placeholder);
        })
      ) {
        acknowledgedEmptyTargets.add(targetKey);
      }
    }
  }
  return acknowledgedEmptyTargets;
}

function allTargetContentIsRepresented(
  reply: string,
  targets: TrackedTarget[]
): boolean {
  const acknowledgedEmptyTargets = acknowledgedEmptyTargetKeys(reply, targets);
  return (
    targets.length > 0 &&
    targets.every(([targetKey, target]) => {
      if (!target.empty) {
        return target.anchorGroups.every((anchors) =>
          containsRepresentativeReadContent(reply, anchors)
        );
      }
      return acknowledgedEmptyTargets.has(targetKey);
    })
  );
}

function anyTargetContentIsRepresented(
  reply: string,
  targets: TrackedTarget[]
): boolean {
  return targets.some(
    ([, target]) => matchedReadContentCount(reply, target.anchors) > 0
  );
}

function replyCompletesTrackedRead(
  reply: string,
  state: RunState,
  userRequest = ''
): boolean {
  const targets = relevantTargets(reply, state);
  if (
    claimsNonEmptyTargetIsEmpty(reply, targets) &&
    !allTargetContentIsRepresented(reply, targets)
  )
    return false;
  const acknowledgedEmptyTargets = acknowledgedEmptyTargetKeys(reply, targets);
  const allEmptyTargetsAreAcknowledged = targets.every(
    ([targetKey, target]) =>
      !target.empty || acknowledgedEmptyTargets.has(targetKey)
  );
  const hasTruncated = hasTruncatedTarget(targets);
  const representedBoundedExtract =
    hasTruncated &&
    requestsBoundedFileRange(userRequest) &&
    targets.every(([, target]) => !target.truncated || target.bounded) &&
    allTargetContentIsRepresented(reply, targets) &&
    !FULL_FILE_DELIVERY_CLAIM.test(reply);
  return (
    representedBoundedExtract ||
    (!hasTruncated &&
      (allTargetContentIsRepresented(reply, targets) ||
        (allEmptyTargetsAreAcknowledged &&
          !isIncompleteFileDeliveryReply(reply) &&
          !EXPLICIT_FULL_FILE_DELIVERY_CLAIM.test(reply) &&
          !(
            FULL_FILE_DELIVERY_CLAIM.test(reply) &&
            anyTargetContentIsRepresented(reply, targets)
          ))))
  );
}

function revisionInstruction(
  targets: TrackedTarget[],
  attempt: number
): string {
  const finalAttempt =
    attempt === MAX_REVISION_ATTEMPTS
      ? ' This is the final correction attempt.'
      : '';
  if (hasTruncatedTarget(targets)) {
    return `A read tool returned only part of the requested file, and your draft did not complete the original request.${finalAttempt} Continue reading from the appropriate offset as needed, then answer the user's original request using the complete result. Preserve any requested summary, transformation, or privacy constraint; do not dump raw contents unless the user asked for them. Do not send another progress-only update or claim delivery without visible output.`;
  }
  if (allTargetsAreEmpty(targets)) {
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
      if (!runId) {
        return;
      }
      if (input.toolName !== 'read') {
        if (
          !FILE_MUTATION_TOOLS.has(input.toolName) ||
          nonEmptyError(input.error) ||
          toolResultIsError(input.result)
        )
          return;
        const existing = runs.get(runId);
        if (!existing) return;
        const changedTargets = mutationTargets(input.toolName, input.params);
        // A successful patch with an unrecognized payload may have changed any
        // previously read file. Discard all evidence rather than carrying stale
        // anchors or truncation state into the assistant's final response.
        if (!changedTargets) {
          runs.delete(runId);
          return;
        }
        const invalidatedTargets = [...existing.targets.keys()].filter(
          (targetKey) =>
            changedTargets.some((changedTarget) =>
              targetKeysMayMatch(targetKey, changedTarget)
            )
        );
        if (invalidatedTargets.length === 0) return;
        const targets = new Map(existing.targets);
        for (const targetKey of invalidatedTargets) targets.delete(targetKey);
        if (targets.size === 0) {
          runs.delete(runId);
          return;
        }
        touch(runId, {
          ...existing,
          messageDelivery: null,
          lastSuccessfulTarget: invalidatedTargets.includes(
            existing.lastSuccessfulTarget ?? ''
          )
            ? null
            : existing.lastSuccessfulTarget,
          targets,
        });
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
          anchorGroups: target?.anchorGroups ?? [],
          anchors: target?.anchors ?? [],
          bounded: target?.bounded ?? false,
          empty: target?.empty ?? false,
          failed: true,
          // Failed reads are not progress. Preserve the last successful offset
          // so a retry at the same requested continuation can still recover.
          lastOffset: target?.lastOffset ?? 0,
          nextOffset: target?.nextOffset ?? null,
          truncated: target?.truncated ?? false,
        });
        touch(runId, {
          messageDelivery: existing?.messageDelivery ?? null,
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
      const chunkAnchors = contentAnchors(text);
      const offset = readOffset(input.params);
      const startsFreshVersion =
        existingTarget != null && !existingTarget.truncated && offset === 0;
      const anchors = Array.from(
        new Set([
          ...chunkAnchors,
          ...(startsFreshVersion ? [] : (existingTarget?.anchors ?? [])),
        ])
      ).slice(0, MAX_ANCHORS_PER_RUN);
      const anchorGroups = [
        ...(startsFreshVersion ? [] : (existingTarget?.anchorGroups ?? [])),
      ];
      if (
        chunkAnchors.length > 0 &&
        !anchorGroups.some(
          (group) =>
            group.length === chunkAnchors.length &&
            group.every((anchor, index) => anchor === chunkAnchors[index])
        )
      ) {
        anchorGroups.push(chunkAnchors);
      }
      const resultWasTruncated = TRUNCATION_MARKER.test(text);
      const continuedFromExpectedOffset =
        existingTarget?.truncated === true &&
        existingTarget.nextOffset !== null &&
        offset === existingTarget.nextOffset;
      const nextOffset = resultWasTruncated
        ? existingTarget?.truncated === true && !continuedFromExpectedOffset
          ? existingTarget.nextOffset
          : nextOffsetFromTruncationMarker(text)
        : existingTarget?.truncated === true && !continuedFromExpectedOffset
          ? existingTarget.nextOffset
          : null;
      targets.set(targetKey, {
        anchorGroups,
        anchors,
        bounded: readIsExplicitlyBounded(input.params),
        empty:
          (startsFreshVersion ? true : (existingTarget?.empty ?? true)) &&
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
        // Any successful read after a message-tool delivery adds new work.
        // Only a later qualifying delivery may suppress final correction.
        messageDelivery: null,
        lastSuccessfulTarget: targetKey,
        revisionAttempts: existing?.revisionAttempts ?? 0,
        targets,
      });
    },

    recordMessageDelivery(input: FileReadMessageDelivery): void {
      const runId = input.runId?.trim();
      const sessionKey = input.sessionKey?.trim();
      if (!runId || !sessionKey || !input.success) return;
      const existing = runs.get(runId);
      if (!existing || hasRelevantFailedTarget(input.content ?? '', existing))
        return;
      touch(runId, {
        messageDelivery: { content: input.content ?? '', sessionKey },
        lastSuccessfulTarget: existing.lastSuccessfulTarget,
        revisionAttempts: existing.revisionAttempts,
        targets: new Map(existing.targets),
      });
    },

    beforeFinalize(input: FileReadFinalizeInput): FileReadRevision | null {
      const runId = input.runId?.trim();
      const reply = input.lastAssistantMessage ?? '';
      if (!runId) return null;
      const state = runs.get(runId);
      const userRequest = lastUserRequest(input.messages);
      if (
        !state ||
        (state.messageDelivery != null &&
          state.messageDelivery.sessionKey === input.sessionKey?.trim() &&
          replyCompletesTrackedRead(
            state.messageDelivery.content,
            state,
            userRequest
          )) ||
        hasRelevantFailedTarget(reply, state) ||
        state.revisionAttempts >= MAX_REVISION_ATTEMPTS
      )
        return null;
      const targets = relevantTargets(reply, state);
      if (replyCompletesTrackedRead(reply, state, userRequest)) {
        return null;
      }

      const attempt = state.revisionAttempts + 1;
      touch(runId, { ...state, revisionAttempts: attempt });
      return {
        action: 'revise',
        reason: 'successful file read was not delivered in the draft reply',
        retry: {
          instruction: revisionInstruction(targets, attempt),
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
