import type * as db from '@tloncorp/shared/db';

import { formatUserId } from '../../utils/user';
import type { SettingsRowModel } from './types';

/**
 * The start of a settings row for a person: their avatar, with their nickname
 * over their ID, or the ID alone when they have no nickname to show.
 */
export function contactSettingsRow(
  contactId: string,
  contact: db.Contact | null | undefined,
  disableNicknames: boolean
): Pick<SettingsRowModel, 'key' | 'title' | 'subtitle' | 'leading'> {
  const userId = formatUserId(contactId)?.display ?? contactId;
  const nickname = disableNicknames ? null : contact?.nickname;
  return {
    key: contactId,
    title: nickname || userId,
    subtitle: nickname ? userId : undefined,
    leading: { kind: 'contact', contactId },
  };
}
