import * as db from '@tloncorp/shared/dist/db';
import * as urbit from '@tloncorp/shared/dist/urbit';
import { cite as shorten } from '@urbit/aura';

const USER_ID_SEPARATORS = /([_^-])/;

export function formatUserId(
  userId: string,
  full = false
): { display: string; ariaLabel: string } | null {
  const shortenedName = full ? userId : shorten(userId);
  if (!shortenedName) return null;

  const ariaLabel = urbit
    .desig(shortenedName)
    .split(USER_ID_SEPARATORS)
    .join(' ');

  return {
    display: shortenedName,
    ariaLabel,
  };
}

export function getDisplayName(contact: db.Contact) {
  return contact.nickname ? contact.nickname : contact.id;
}
