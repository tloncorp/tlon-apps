import { setSetting } from '../api';
import * as db from '../db';
import { TalkSidebarFilter } from '../urbit';

export async function changeMessageFilter(
  filter: TalkSidebarFilter,
  userId: string
) {
  const existing = await db.getSettings(userId);
  const oldFilter = existing?.messagesFilter;
  try {
    // optimistic update
    await db.insertSettings({ userId, messagesFilter: filter });
    return setSetting('messagesFilter', filter);
  } catch (e) {
    console.error('Failed to change message filter', e);
    await db.insertSettings({ userId, messagesFilter: oldFilter });
  }
}
