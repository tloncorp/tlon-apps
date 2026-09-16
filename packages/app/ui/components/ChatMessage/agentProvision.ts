import {
  AGENT_ONBOARDING_APPROACH_CHOICE_MARKER,
  parsePostBlob,
  type PostBlobDataEntryA2UISelection,
} from '@tloncorp/api';

type EvidencePost = {
  id: string;
  authorId: string;
  channelId: string;
  receivedAt: number;
  sequenceNum?: number | null;
  blob?: string | null;
  isDeleted?: boolean | null;
};

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

export function hasAnsweredApproachChoice(input: {
  approach: string | undefined;
  selections: PostBlobDataEntryA2UISelection[];
  sourcePosts: Array<EvidencePost | null>;
  planPost: EvidencePost;
  botAuthorId: string;
}) {
  const expected = input.approach?.trim().toLocaleLowerCase();
  if (!expected) return false;
  const postsById = new Map(
    input.sourcePosts
      .filter((post): post is EvidencePost => Boolean(post))
      .map((post) => [post.id, post])
  );
  return input.selections.some((selection) => {
    if (
      !selection.sourcePostId ||
      !selection.values.some(
        (value) => value.trim().toLocaleLowerCase() === expected
      )
    ) {
      return false;
    }
    const sourcePost = postsById.get(selection.sourcePostId);
    return Boolean(
      sourcePost &&
      sourcePost.authorId === input.botAuthorId &&
      sourcePost.channelId === input.planPost.channelId &&
      !sourcePost.isDeleted &&
      follows(input.planPost, sourcePost) &&
      sourcePost.blob &&
      parsePostBlob(sourcePost.blob).some(
        (entry) =>
          entry.type === 'tlon-agent-post-marker' &&
          entry.key === AGENT_ONBOARDING_APPROACH_CHOICE_MARKER
      )
    );
  });
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
