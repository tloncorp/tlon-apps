import * as db from '../db';
import { normalizeUrbitColor } from '../logic';
import * as ub from '../urbit';
import { scry } from './urbit';

export const getContacts = async () => {
  const results = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });
  return toClientContacts(results);
};

export const toClientContacts = (
  contacts: ub.ContactRolodex
): db.ContactInsert[] => {
  return Object.entries(contacts).flatMap(([ship, contact]) =>
    contact === null ? [] : [toClientContact(ship, contact)]
  );
};

export const toClientContact = (
  id: string,
  contact: ub.Contact | null
): db.ContactInsert => {
  return {
    id,
    nickname: contact?.nickname ?? null,
    bio: contact?.bio ?? null,
    status: contact?.status ?? null,
    color: contact?.color ? normalizeUrbitColor(contact.color) : null,
    coverImage: contact?.cover ?? null,
    avatarImage: contact?.avatar ?? null,
    pinnedGroups:
      contact?.groups?.map((groupId) => ({
        groupId,
        contactId: id,
      })) ?? [],
  };
};
