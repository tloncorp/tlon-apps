/* eslint-disable no-param-reassign */
import { useCallback, useMemo } from 'react';
import _ from 'lodash';
import api from '@/api';
import { BaseState, createState } from '@/state/base';
import {
  ContactAnon,
  ContactEdit,
  ContactEditField,
  ContactHeed,
  ContactNews,
  ContactRolodex,
} from '@/types/contact';
import { Patp, preSig } from '@urbit/api';
import produce from 'immer';

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

function contactAction<T>(data: T) {
  return {
    app: 'contacts',
    mark: 'contact-action',
    json: data,
  };
}

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

const selContacts = (s: ContactState) => s.contacts;
export function useContacts() {
  return useContactState(selContacts);
}

export function useMemoizedContacts() {
  return useMemo(() => useContactState.getState().contacts, []);
}

export function useContact(ship: string) {
  return useContactState(
    useCallback((s) => s.contacts[preSig(ship)] || emptyContact, [ship])
  );
}

export function useOurContact() {
  return useContact(window.our);
}

export default useContactState;
