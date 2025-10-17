import * as db from '@tloncorp/shared/db';
import * as urbit from '@tloncorp/shared/urbit';
import { p } from '@urbit/aura';

const USER_ID_SEPARATORS = /([_^-])/;

export function formatUserId(
  userId: string,
  full = false
): { display: string; ariaLabel: string } | null {
  const shortenedName = full ? userId : p.cite(userId);
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
  if (contact.nickname && contact.nickname.length) {
    return contact.nickname;
  }

  const formatted = formatUserId(contact.id);
  return formatted?.display ?? contact.id;
}
