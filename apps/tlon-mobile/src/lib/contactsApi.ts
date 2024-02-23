import type { ContactRolodex } from '@tloncorp/shared/dist/urbit/contact';

import type * as db from '../db';
import { scry } from './api';

export const getContacts = async () => {
  const results = await scry<ContactRolodex>({ app: 'contacts', path: '/all' });
  return toClientContacts(results);
};

const toClientContacts = (contacts: ContactRolodex): db.Contact[] => {
  return Object.entries(contacts).map(([ship, contact]) => ({
    id: ship,
    contact,
  }));
};
