import type * as db from '@tloncorp/shared/db';

export type GroupRecencyOverride = {
  label: string;
  timestamp: number;
};

/**
 * Temporary UI companion to the TLON-6417 ordering workaround. When Notes
 * activity moves a group ahead of its latest post, describe that activity
 * instead of showing an unrelated post preview and timestamp.
 */
export function getGroupRecencyOverride(
  chat: db.Chat
): GroupRecencyOverride | null {
  if (chat.type !== 'group' || chat.isPending) {
    return null;
  }

  const latestNotesActivityAt = Math.max(
    0,
    ...(chat.group.channels ?? [])
      .filter((channel) => channel.type === 'notes')
      .map((channel) => channel.unread?.updatedAt ?? 0)
  );

  if (
    latestNotesActivityAt <= (chat.group.lastPostAt ?? 0) ||
    latestNotesActivityAt !== chat.timestamp
  ) {
    return null;
  }

  return {
    label: 'Notes activity',
    timestamp: latestNotesActivityAt,
  };
}
