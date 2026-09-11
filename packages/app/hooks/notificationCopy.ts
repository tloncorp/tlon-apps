// Notification title/body copy, shared by the browser (`useBrowserNotifications`)
// and Electron (`useDesktopNotifications`) surfaces. Mobile push copy lives in
// `packages/scripts/src/index.ts` instead, because the native extensions run it
// as a standalone JS bundle and cannot import from this package.

// Reactions arrive as two distinct event types: `react` in a channel and
// `dm-react` in a DM. Both carry their emoji in the activity event's `content`
// column rather than as post content.
export function isReactActivityType(activityType: string) {
  return activityType === 'react' || activityType === 'dm-react';
}

type NotificationCopyInput = {
  activityType: string;
  channelTitle?: string | null;
  contactName: string;
  contentText: string;
  groupTitle?: string | null;
  reactValue: string;
};

export function getNotificationCopy({
  activityType,
  channelTitle,
  contactName,
  contentText,
  groupTitle,
  reactValue,
}: NotificationCopyInput) {
  const flaggedKind =
    activityType === 'flag-post'
      ? 'post'
      : activityType === 'flag-reply'
        ? 'reply'
        : null;
  const isReact = isReactActivityType(activityType);
  const isDmInvite = activityType === 'dm-invite';
  // note events carry the note title as their content text
  const noteVerb =
    activityType === 'note-create'
      ? 'added'
      : activityType === 'note-edit'
        ? 'edited'
        : null;

  let title = flaggedKind
    ? `Flagged ${flaggedKind}`
    : channelTitle || contactName || 'New message';
  let body = flaggedKind
    ? `A ${flaggedKind} by ${contactName} was flagged in your group`
    : isReact
      ? // name the emoji when we have one; a custom react can serialize to an
        // empty string, and "reacted  to your post" reads worse than omitting it
        `${contactName} reacted${reactValue ? ` ${reactValue}` : ''} to your ${
          activityType === 'dm-react' ? 'message' : 'post'
        }`
      : isDmInvite
        ? // the title already names the inviter (DM titles are the counterparty)
          'Invited you to chat'
        : noteVerb
          ? `${contactName || 'Someone'} ${noteVerb} a note${contentText ? `: ${contentText}` : ''}`
          : contentText || 'New message';

  if (groupTitle) {
    title = `${title} in ${groupTitle}`;
    if (!isReact && !flaggedKind && !noteVerb) {
      body = contentText
        ? `${contactName || 'Someone'}: ${contentText}`
        : `New message in ${groupTitle}`;
    }
  }

  return { title, body };
}
