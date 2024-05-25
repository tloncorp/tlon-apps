import * as db from '../db';
import { normalizeUrbitColor } from '../logic';
import * as ub from '../urbit';
import { poke, scry, subscribe } from './urbit';

export const getContacts = async () => {
  const results = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });
  return toClientContacts(results);
};

export const addContacts = async (contactIds: string[]) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: { heed: contactIds },
  });
};

export type ContactsUpdate =
  | { type: 'add'; contact: db.Contact }
  | { type: 'delete'; contactId: string };

export const subscribeToContactUpdates = (
  handler: (update: ContactsUpdate) => void
) => {
  subscribe(
    {
      app: 'contacts',
      path: '/news',
    },
    (event: ub.ContactNews) => {
      if (event.con) {
        handler({
          type: 'add',
          contact: toClientContact(event.who, event.con),
        });
      } else {
        handler({ type: 'delete', contactId: event.who });
      }
    }
  );
};

export const toClientContacts = (contacts: ub.ContactRolodex): db.Contact[] => {
  return Object.entries(contacts).flatMap(([ship, contact]) =>
    contact === null ? [] : [toClientContact(ship, contact)]
  );
};

export const toClientContact = (
  id: string,
  contact: ub.Contact | null
): db.Contact => {
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
