import {
  AGENT_ONBOARDING_APPROACH_CHOICE_MARKER,
  parsePostBlob,
  type PostBlobDataEntryA2UISelection,
  type PostBlobDataEntryAgentProvision,
} from '@tloncorp/api';

const ANSWER_EVIDENCE_DIMENSIONS = [
  'focus',
  'time',
  'approach',
  'context',
  'priority',
  'output',
] as const;

export function agentPlanAnswerEvidenceMatches(
  left: PostBlobDataEntryAgentProvision['answerEvidence'],
  right: PostBlobDataEntryAgentProvision['answerEvidence']
) {
  if (!left || !right) return left === right;
  return ANSWER_EVIDENCE_DIMENSIONS.every(
    (dimension) => left[dimension] === right[dimension]
  );
}

type EvidencePost = {
  id: string;
  authorId: string;
  channelId: string;
  receivedAt: number;
  sequenceNum?: number | null;
  blob?: string | null;
  isDeleted?: boolean | null;
  deliveryStatus?: string | null;
};

function isAutomaticProvisionTransport(post: EvidencePost) {
  if (!post.blob) return false;
  const entries = parsePostBlob(post.blob);
  return (
    entries.some((entry) => entry.type === 'tlon-agent-provision') &&
    entries.some(
      (entry) =>
        entry.type === 'tlon-a2ui-selection' &&
        entry.componentId === 'auto-provision'
    )
  );
}

function follows(candidate: EvidencePost, reference: EvidencePost) {
  if (
    candidate.sequenceNum != null &&
    candidate.sequenceNum > 0 &&
    reference.sequenceNum != null &&
    reference.sequenceNum > 0 &&
    candidate.sequenceNum !== reference.sequenceNum
  ) {
    return candidate.sequenceNum > reference.sequenceNum;
  }
  return candidate.receivedAt > reference.receivedAt;
}

export function findAnsweredApproachChoiceStart(input: {
  approach: string | undefined;
  interviewStartMessageId: string | undefined;
  interviewMessageId: string | undefined;
  channelPosts: EvidencePost[];
  planPost: EvidencePost;
  botAuthorId: string;
  ownerId: string;
}) {
  const expected = input.approach?.trim().toLocaleLowerCase();
  const interviewEnd = input.channelPosts.find(
    (post) => post.id === input.interviewMessageId
  );
  if (!expected || !interviewEnd || interviewEnd.authorId !== input.ownerId) {
    return undefined;
  }
  for (const answerPost of input.channelPosts) {
    if (
      answerPost.authorId !== input.ownerId ||
      answerPost.isDeleted ||
      (answerPost.id !== interviewEnd.id &&
        follows(answerPost, interviewEnd)) ||
      !answerPost.blob
    ) {
      continue;
    }
    for (const selection of parsePostBlob(answerPost.blob)) {
      if (
        selection.type !== 'tlon-a2ui-selection' ||
        !selection.sourcePostId ||
        !selection.values.some(
          (value) => value.trim().toLocaleLowerCase() === expected
        )
      ) {
        continue;
      }
      const sourcePost = input.channelPosts.find(
        (post) => post.id === selection.sourcePostId
      );
      const marker = sourcePost?.blob
        ? parsePostBlob(sourcePost.blob).find(
            (entry) =>
              entry.type === 'tlon-agent-post-marker' &&
              entry.key === AGENT_ONBOARDING_APPROACH_CHOICE_MARKER
          )
        : undefined;
      const markerStartId =
        marker?.type === 'tlon-agent-post-marker'
          ? marker.interviewStartMessageId
          : undefined;
      const interviewStartMessageId =
        input.interviewStartMessageId ?? markerStartId;
      const interviewStart = input.channelPosts.find(
        (post) => post.id === interviewStartMessageId
      );
      if (
        !markerStartId ||
        markerStartId !== interviewStartMessageId ||
        !interviewStart ||
        interviewStart.authorId !== input.ownerId ||
        interviewStart.channelId !== input.planPost.channelId ||
        interviewStart.isDeleted ||
        !sourcePost ||
        sourcePost.authorId !== input.botAuthorId ||
        sourcePost.channelId !== input.planPost.channelId ||
        sourcePost.isDeleted ||
        !follows(sourcePost, interviewStart) ||
        !follows(answerPost, sourcePost) ||
        !follows(input.planPost, sourcePost)
      ) {
        continue;
      }
      return interviewStartMessageId;
    }
  }
  return undefined;
}

export function hasAnsweredApproachChoice(
  input: Parameters<typeof findAnsweredApproachChoiceStart>[0]
) {
  return Boolean(findAnsweredApproachChoiceStart(input));
}

export function hasNewerOwnerPost(input: {
  planPost: EvidencePost;
  channelPosts: EvidencePost[];
  ownerId: string;
}) {
  return input.channelPosts.some(
    (candidate) =>
      candidate.authorId === input.ownerId &&
      !candidate.isDeleted &&
      candidate.id !== input.planPost.id &&
      follows(candidate, input.planPost)
  );
}

export function isCurrentOwnerInterview(input: {
  interviewStartMessageId: string | undefined;
  interviewMessageId: string | undefined;
  planPost: EvidencePost;
  channelPosts: EvidencePost[];
  ownerId: string;
}) {
  if (!input.interviewMessageId) return false;
  const interviewStart = input.interviewStartMessageId
    ? input.channelPosts.find(
        (candidate) => candidate.id === input.interviewStartMessageId
      )
    : undefined;
  const interviewPost = input.channelPosts.find(
    (candidate) => candidate.id === input.interviewMessageId
  );
  if (
    !interviewPost ||
    interviewPost.authorId !== input.ownerId ||
    interviewPost.channelId !== input.planPost.channelId ||
    interviewPost.isDeleted ||
    !follows(input.planPost, interviewPost)
  ) {
    return false;
  }
  if (
    input.interviewStartMessageId &&
    (!interviewStart ||
      interviewStart.authorId !== input.ownerId ||
      interviewStart.channelId !== input.planPost.channelId ||
      interviewStart.isDeleted ||
      (interviewPost.id !== interviewStart.id &&
        !follows(interviewPost, interviewStart)))
  ) {
    return false;
  }
  return !input.channelPosts.some(
    (candidate) =>
      candidate.authorId === input.ownerId &&
      candidate.id !== interviewPost.id &&
      !candidate.isDeleted &&
      !isAutomaticProvisionTransport(candidate) &&
      follows(candidate, interviewPost)
  );
}

export function findConsumedProvisionSelection(input: {
  sourcePostId: string;
  surfaceId: string;
  componentId: string;
  selections: PostBlobDataEntryA2UISelection[] | undefined;
  successfulProvisionSelections: PostBlobDataEntryA2UISelection[] | undefined;
}) {
  const candidates =
    input.componentId === 'auto-provision'
      ? input.successfulProvisionSelections
      : input.selections;
  return candidates?.find(
    (entry) =>
      entry.sourcePostId === input.sourcePostId &&
      entry.surfaceId === input.surfaceId &&
      entry.componentId === input.componentId
  );
}

export function resolveAgentProvisionTimezone(
  timezoneOverride: string | undefined,
  deviceTimezone: string | undefined
) {
  return timezoneOverride?.trim() || deviceTimezone?.trim() || 'UTC';
}

export function resolveAgentProvisionId(
  sourcePostId: string,
  componentId: string | undefined,
  fallbackId: string,
  payloadIdentity = ''
) {
  if (componentId !== 'auto-provision') return fallbackId;
  let hash = 2166136261;
  for (const character of payloadIdentity) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `auto-${(hash >>> 0).toString(36)}-${sourcePostId}`.slice(0, 128);
}

export function resolveAgentProvisionButtonLabel(
  defaultLabel: string,
  pending: boolean,
  consumed: boolean
) {
  if (pending) return 'Creating…';
  if (consumed) return 'Request sent';
  return defaultLabel;
}
