import {
  getCanonicalPostId,
  parsePostBlob,
  type PostBlobDataEntryA2UISelection,
} from '@tloncorp/api';

import { followsByChannelOrder } from './postOrdering';

export type EvidencePost = {
  id: string;
  authorId: string;
  channelId: string;
  receivedAt: number;
  sequenceNum?: number | null;
  type?: string | null;
  parentId?: string | null;
  blob?: string | null;
  isDeleted?: boolean | null;
  deliveryStatus?: string | null;
};

function samePostId(left: string | undefined, right: string | undefined) {
  return Boolean(
    left && right && getCanonicalPostId(left) === getCanonicalPostId(right)
  );
}

export async function loadReferencedInterviewPosts(input: {
  interviewStartMessageId: string | undefined;
  interviewMessageId: string | undefined;
  channelPosts: EvidencePost[];
  loadAround: (postId: string) => Promise<EvidencePost[]>;
}) {
  const referencedIds = [
    input.interviewStartMessageId,
    input.interviewMessageId,
  ].filter((id): id is string => Boolean(id));
  const missingIds = referencedIds.filter(
    (id) =>
      !input.channelPosts.some((candidate) => samePostId(candidate.id, id))
  );
  if (missingIds.length === 0) return input.channelPosts;

  const remotePosts = (
    await Promise.all(missingIds.map(input.loadAround))
  ).flat();
  const merged = [...input.channelPosts];
  for (const candidate of remotePosts) {
    if (!merged.some((post) => samePostId(post.id, candidate.id))) {
      merged.push(candidate);
    }
  }
  return merged;
}

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

function isRootConversationPost(post: EvidencePost) {
  return post.type !== 'reply' && !post.parentId;
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
    ? input.channelPosts.find((candidate) =>
        samePostId(candidate.id, input.interviewStartMessageId)
      )
    : undefined;
  const interviewPost = input.channelPosts.find((candidate) =>
    samePostId(candidate.id, input.interviewMessageId)
  );
  if (
    !interviewPost ||
    interviewPost.authorId !== input.ownerId ||
    interviewPost.channelId !== input.planPost.channelId ||
    interviewPost.isDeleted ||
    !followsByChannelOrder(input.planPost, interviewPost)
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
        !followsByChannelOrder(interviewPost, interviewStart)))
  ) {
    return false;
  }
  return !input.channelPosts.some(
    (candidate) =>
      candidate.authorId === input.ownerId &&
      !samePostId(candidate.id, interviewPost.id) &&
      !candidate.isDeleted &&
      candidate.deliveryStatus !== 'failed' &&
      isRootConversationPost(candidate) &&
      !isAutomaticProvisionTransport(candidate) &&
      followsByChannelOrder(candidate, interviewPost)
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
