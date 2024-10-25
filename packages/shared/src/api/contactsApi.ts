import * as db from '../db';
import { createDevLogger } from '../debug';
import { normalizeUrbitColor } from '../logic';
import * as ub from '../urbit';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('contactsApi', true);

export const getContacts = async () => {
  const results = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });

  // new book
  // - are they a contact
  // - if yes, do they have nickname override
  const contactBook = await scry<Record<string, any>>({
    app: 'contacts',
    path: '/v1/book',
  });
  logger.log('contactBook', contactBook);

  return toClientContacts(results, contactBook);
};

export const addContacts = async (contactIds: string[]) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: { heed: contactIds },
  });
};

export const addContact = async (contactId: string) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: {
      page: { kip: contactId },
    },
  });
};

export const removeContact = async (contactId: string) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { wipe: [contactId] },
  });
};

export interface ProfileUpdate {
  nickname?: string;
  bio?: string;
  avatarImage?: string;
  coverImage?: string;
}
export const updateCurrentUserProfile = async (update: ProfileUpdate) => {
  const editedFields: ub.ContactEditField[] = [];
  if (update.nickname !== undefined) {
    editedFields.push({ nickname: update.nickname });
  }

  if (update.bio !== undefined) {
    editedFields.push({ bio: update.bio });
  }

  if (update.avatarImage !== undefined) {
    editedFields.push({ avatar: update.avatarImage });
  }

  if (update.coverImage !== undefined) {
    editedFields.push({ cover: update.coverImage });
  }

  const action: ub.ContactEdit = {
    edit: editedFields,
  };

  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: action,
  });
};

export const addPinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'add-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
  });
};

export const removePinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'del-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
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

export const toClientContacts = (
  contacts: ub.ContactRolodex,
  contactBook: Record<string, any>
): db.Contact[] => {
  return Object.entries(contacts).flatMap(([ship, contact]) =>
    contact === null
      ? []
      : [toClientContact(ship, contact, ship in contactBook)]
  );
};

export const toClientContact = (
  id: string,
  contact: ub.Contact | null,
  isContact?: boolean
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
    isContact,
  };
};
