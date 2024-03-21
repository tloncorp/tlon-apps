/* eslint-disable no-param-reassign */
import {
  getContact,
  getContacts,
  insertContacts,
} from '@tloncorp/shared/dist/db/queries';
import { Contact as DBContact } from '@tloncorp/shared/dist/db/schemas';
import {
  Contact,
  ContactAnon,
  ContactEdit,
  ContactEditField,
  ContactHeed,
  ContactNews,
  ContactRolodex,
} from '@tloncorp/shared/dist/urbit/contact';
import { Patp, preSig } from '@urbit/api';
import produce from 'immer';
import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import api from '@/api';
import { BaseState, createState } from '@/state/base';

export interface BaseContactState {
  contacts: ContactRolodex;
  nackedContacts: Set<Patp>;
  edit: (fields: ContactEditField[]) => Promise<void>;
  /** removes our profile */
  anon: () => Promise<void>;
  /** subscribes to profile updates */
  heed: (ships: string[]) => Promise<void>;
  fetchAll: () => Promise<void>;
  start: () => void;
  [ref: string]: unknown;
}

type ContactState = BaseContactState & BaseState<BaseContactState>;

function dbContactToContact(dbContact: DBContact): Contact {
  return {
    nickname: dbContact.nickname ?? '',
    bio: dbContact.bio ?? '',
    status: dbContact.status ?? '',
    color: dbContact.color ?? '0x0',
    avatar: dbContact.avatarImage,
    cover: dbContact.coverImage,
    groups: dbContact.pinnedGroupIds ? dbContact.pinnedGroupIds.split(',') : [],
  };
}

function contactAction<T>(data: T) {
  return {
    app: 'contacts',
    mark: 'contact-action',
    json: data,
  };
}

export const fetchAllContacts = async () => {
  const contacts = await api.scry<ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });

  // if (contacts !== null) {
    // insertContacts(contacts);
  // }
};

const useContactState = createState<BaseContactState>(
  'Contact',
  (set, get) => ({
    contacts: {},
    nackedContacts: new Set(),
    fetchAll: async () => {
      const contacts = await api.scry<ContactRolodex>({
        app: 'contacts',
        path: '/all',
      });

      set(
        produce((draft: BaseContactState) => {
          draft.contacts = {
            ...draft.contacts,
            ...contacts,
          };
        })
      );
    },
    edit: async (contactFields) => {
      await api.poke<ContactEdit>(contactAction({ edit: contactFields }));
    },
    anon: async () => {
      await api.poke<ContactAnon>(contactAction({ anon: null }));
    },
    heed: async (ships) => {
      await api.poke<ContactHeed>(contactAction({ heed: ships }));
    },
    start: () => {
      get().fetchAll();

      api.subscribe({
        app: 'contacts',
        path: '/news',
        event: (event: ContactNews) => {
          console.log({ event });
          set(
            produce((draft: ContactState) => {
              if (event.con) {
                draft.contacts[event.who] = event.con;
              } else {
                delete draft.contacts[event.who];
              }
            })
          );
        },
      });
    },
  }),
  {
    partialize: ({ contacts }) => ({ contacts }),
  },
  []
);

export const emptyContact = {
  nickname: '',
  bio: '',
  status: '',
  color: '0x0',
  avatar: null,
  cover: null,
  groups: [] as string[],
};

export function useContacts(): ContactRolodex {
  const [contacts, setContacts] = useState<ContactRolodex | null>(null);

  useEffect(() => {
    const getContactsFromDb = async () => {
      // const contactsFromDb = (await getContacts()) as DBContact[];

      // if (contactsFromDb !== null) {
        // const contactsFromDbMapped = _.mapValues(
          // _.keyBy(contactsFromDb, 'id'),
          // dbContactToContact
        // );

        // setContacts(contactsFromDbMapped);
      // }
    };

    getContactsFromDb();
  }, []);

  return contacts ?? {};
}

export function useMemoizedContacts() {
  return useMemo(() => useContactState.getState().contacts, []);
}

export function useContact(ship: string): Contact {
  const [contact, setContact] = useState<Contact | null>(null);

  useEffect(() => {
    const getContactFromDb = async () => {
      // const contactFromDb = (await getContact(ship)) as DBContact;

      // if (contactFromDb && contactFromDb !== null) {
        // setContact(dbContactToContact(contactFromDb));
      // }
    };

    getContactFromDb();
  }, [ship]);

  return contact ?? emptyContact;
}

export function useOurContact() {
  return useContact(window.our);
}

export default useContactState;
