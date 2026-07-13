type BrowserNotificationCopyInput = {
  activityType: string;
  channelTitle?: string | null;
  contactName: string;
  contentText: string;
  groupTitle?: string | null;
  reactValue: string;
};

export function getBrowserNotificationCopy({
  activityType,
  channelTitle,
  contactName,
  contentText,
  groupTitle,
  reactValue,
}: BrowserNotificationCopyInput) {
  const flaggedKind =
    activityType === 'flag-post'
      ? 'post'
      : activityType === 'flag-reply'
        ? 'reply'
        : null;
  const isReact = activityType === 'react';

  let title = flaggedKind
    ? `Flagged ${flaggedKind}`
    : channelTitle || contactName || 'New message';
  let body = flaggedKind
    ? `${contactName} flagged a ${flaggedKind} in your group`
    : isReact
      ? `${contactName} reacted${reactValue ? ` ${reactValue}` : ''} to your post`
      : contentText || 'New message';

  if (groupTitle) {
    title = `${title} in ${groupTitle}`;
    if (!isReact && !flaggedKind) {
      body = contentText
        ? `${contactName || 'Someone'}: ${contentText}`
        : `New message in ${groupTitle}`;
    }
  }

  return { title, body };
}

type BrowserNotificationTargetInput = {
  parentAuthorId?: string | null;
  parentId?: string | null;
  postId?: string | null;
};

type BrowserNotificationNavigationTarget =
  | { type: 'channel' }
  | {
      type: 'thread';
      parentAuthorId: string;
      parentId: string;
      selectedPostId?: string;
    };

function getBrowserNotificationNavigationTarget({
  parentAuthorId,
  parentId,
  postId,
}: BrowserNotificationTargetInput): BrowserNotificationNavigationTarget {
  if (!parentId) {
    return { type: 'channel' };
  }

  return {
    type: 'thread',
    parentAuthorId: parentAuthorId ?? '',
    parentId,
    selectedPostId: postId ?? undefined,
  };
}

type BrowserNotificationNavigationInput = BrowserNotificationTargetInput & {
  channelId: string;
  groupId?: string | null;
};

type BrowserNotificationNavigationActions = {
  resetToChannel: (channelId: string, options: { groupId?: string }) => void;
  resetToPost: (post: {
    postId: string;
    authorId: string;
    channelId: string;
    groupId?: string;
    selectedPostId?: string;
  }) => void;
};

export function navigateToBrowserNotificationTarget(
  input: BrowserNotificationNavigationInput,
  actions: BrowserNotificationNavigationActions
) {
  const target = getBrowserNotificationNavigationTarget(input);
  const groupId = input.groupId ?? undefined;

  if (target.type === 'thread') {
    actions.resetToPost({
      postId: target.parentId,
      authorId: target.parentAuthorId,
      channelId: input.channelId,
      groupId,
      selectedPostId: target.selectedPostId,
    });
    return;
  }

  actions.resetToChannel(input.channelId, { groupId });
}
