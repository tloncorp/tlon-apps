import { create } from 'zustand';
import useStore from './store';
import type { Contact, ContactRolodex } from '../types/contact';

export interface ContactState {
  contacts: ContactRolodex;
  unknownContacts: string[];
  fetchAll: () => Promise<ContactRolodex>;
  fetchContact: (who: string) => Promise<Contact | null>;
}

const useContactState = create<ContactState>((set, get) => ({
  contacts: {},
  unknownContacts: [],
  fetchAll: async () => {
    const { api } = useStore.getState();
    if (!api) {
      throw new Error('No api found');
    }

    const contacts = await api.scry<ContactRolodex>({
      app: 'contacts',
      path: '/all',
    });
    set((state) => ({ ...state, contacts }));
    return contacts;
  },
  fetchContact: async (who: string) => {
    const knownContact = get().contacts[who];
    if (knownContact) {
      return knownContact;
    }

    if (get().unknownContacts.includes(who)) {
      return null;
    }

    const contacts = await get().fetchAll();
    const contact = contacts[who];
    if (!contact) {
      set((state) => ({
        ...state,
        unknownContacts: [...state.unknownContacts, who],
      }));
      return null;
    }

    return contact;
  },
}));

export default useContactState;
