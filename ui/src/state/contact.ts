/* eslint-disable no-param-reassign */
import {
  Contact,
  ContactEditFieldPrim,
  ContactEditField,
  ContactUpdate,
  editContact,
  setPublic as pokeSetPublic,
  deSig,
  Patp,
  Rolodex,
} from '@urbit/api';
import { useCallback, useMemo } from 'react';
import _ from 'lodash';
import api from '@/api';
import {
  BaseState,
  createState,
  createSubscription,
  reduceStateN,
} from '@/state/base';

export interface BaseContactState {
  contacts: Rolodex;
  isContactPublic: boolean;
  nackedContacts: Set<Patp>;
  editContactField: (
    ship: string,
    contactField: ContactEditField
  ) => Promise<void>;
  setContactPublic: (isPublic: boolean) => Promise<void>;
  [ref: string]: unknown;
}

type ContactState = BaseContactState & BaseState<BaseContactState>;

const initial = (json: ContactUpdate, state: ContactState): ContactState => {
  const data = _.get(json, 'initial', false);
  if (data) {
    state.contacts = data.rolodex;
    state.isContactPublic = data['is-public'];
  }
  return state;
};

const add = (json: ContactUpdate, state: ContactState): ContactState => {
  const data = _.get(json, 'add', false);
  if (data) {
    state.contacts[data.ship] = data.contact;
  }
  return state;
};

const remove = (json: ContactUpdate, state: ContactState): ContactState => {
  const data = _.get(json, 'remove', false);
  if (data && data.ship in state.contacts) {
    delete state.contacts[data.ship];
  }
  return state;
};

export const edit = (
  json: ContactUpdate,
  state: ContactState
): ContactState => {
  const data = _.get(json, 'edit', false);
  const ship = `~${deSig(data.ship)}`;
  if (data && ship in state.contacts) {
    const [field] = Object.keys(data['edit-field']);
    if (!field) {
      return state;
    }

    const value = data['edit-field'][field];
    if (field === 'add-group') {
      if (typeof value !== 'string') {
        state.contacts[ship].groups.push(`${Object.values(value).join('/')}`);
      } else if (!state.contacts[ship].groups.includes(value)) {
        state.contacts[ship].groups.push(value);
      }
    } else if (field === 'remove-group') {
      if (typeof value !== 'string') {
        state.contacts[ship].groups = state.contacts[ship].groups.filter(
          (g) => g !== `${Object.values(value).join('/')}`
        );
      } else {
        state.contacts[ship].groups = state.contacts[ship].groups.filter(
          (g) => g !== value
        );
      }
    } else {
      const k = field as ContactEditFieldPrim;
      state.contacts[ship][k] = value;
    }
  }
  return state;
};

const setPublic = (json: ContactUpdate, state: ContactState): ContactState => {
  const data = _.get(json, 'set-public', state.isContactPublic);
  state.isContactPublic = data;
  return state;
};

export const reduceNacks = (
  json: { resource?: { res: string } },
  state: ContactState
): ContactState => {
  const data = json?.resource;
  if (data) {
    state.nackedContacts.add(`~${data.res}`);
  }
  return state;
};

export const reduce = [initial, add, remove, edit, setPublic];

const useContactState = createState<BaseContactState>(
  'Contact',
  {
    contacts: {},
    nackedContacts: new Set(),
    isContactPublic: false,
    editContactField: async (ship: string, contactField: ContactEditField) => {
      await api.poke(editContact(ship, contactField));
    },
    setContactPublic: async (isPublic: boolean) => {
      await api.poke(pokeSetPublic(isPublic));
    },
  },
  ['contacts'],
  [
    (set, get) =>
      createSubscription('contact-pull-hook', '/nacks', (e) => {
        const data = e?.resource;
        if (data) {
          reduceStateN(get(), data, [reduceNacks]);
        }
      }),
    (set, get) =>
      createSubscription('contact-store', '/all', (e) => {
        const data = _.get(e, 'contact-update', false);
        if (data) {
          reduceStateN(get(), data, reduce);
        }
      }),
  ]
);

const selContacts = (s: ContactState) => s.contacts;
export function useContacts() {
  return useContactState(selContacts);
}

export function useMemoizedContacts() {
  return useMemo(() => useContactState.getState().contacts, []);
}

export function isOurContactPublic() {
  return useContactState.getState().isContactPublic;
}

export function useContact(ship: string) {
  return useContactState(
    useCallback(
      (s) => s.contacts[`~${deSig(ship)}`] as Contact | undefined,
      [ship]
    )
  );
}

export function useOurContact() {
  return useContact(`~${window.ship}`);
}

export default useContactState;
