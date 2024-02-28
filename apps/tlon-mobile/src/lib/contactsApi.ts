import type * as ub from '@tloncorp/shared/dist/urbit/contact';
import { parseUx } from '@urbit/aura';

import type * as db from '../db';
import { scry } from './api';

export const getContacts = async () => {
  const results = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });
  return toClientContacts(results);
};

export const toClientContacts = (contacts: ub.ContactRolodex): db.Contact[] => {
  return Object.entries(contacts).map(([ship, contact]) =>
    toClientContact(ship, contact)
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
    color: contact?.color ? '#' + parseUx(contact.color) : null,
    coverImage: contact?.cover ?? null,
    avatarImage: contact?.avatar ?? null,
    pinnedGroupIds: contact?.groups ?? [],
  };
};
