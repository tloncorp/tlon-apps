import type * as db from '@tloncorp/shared/db';
import { formatNotesActivityLabel } from '@tloncorp/shared/logic';

export type GroupRecencyOverride = {
  label: string;
  timestamp: number;
  channelId: string;
};

/**
 * When a group's newest activity is a note rather than a post, describe that
 * note instead of showing the older post preview and timestamp. Pending groups
 * retain their invite presentation; pinned groups still get a fresh preview.
 */
export function getGroupRecencyOverride(
  chat: db.Chat
): GroupRecencyOverride | null {
  if (chat.type !== 'group' || chat.isPending) {
    return null;
  }

  const activity = chat.notesActivity;
  if (!activity || activity.timestamp <= (chat.group.lastPostAt ?? 0)) {
    return null;
  }

  return {
    label: formatNotesActivityLabel(activity),
    timestamp: activity.timestamp,
    channelId: activity.channelId,
  };
}
