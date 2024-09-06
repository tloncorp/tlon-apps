import * as db from '@tloncorp/shared/dist/db';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';

export type CurrentAppDataState = {
  currentUserId: string;
  contacts: db.Contact[] | null;
  contactIndex: Record<string, db.Contact> | null;
  branchDomain: string;
  branchKey: string;
};

type ContextValue = CurrentAppDataState;

const defaultState: CurrentAppDataState = {
  currentUserId: '',
  contacts: null,
  contactIndex: null,
  branchDomain: '',
  branchKey: '',
};

const Context = createContext<ContextValue>(defaultState);

export const useCurrentUserId = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useCurrentUser` within an `CurrentUserProvider` component.'
    );
  }

  return context.currentUserId;
};

export const useContacts = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useContacts` within an `ContactsProvider` component.'
    );
  }

  return context.contacts;
};

export const useContactIndex = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useContacts` within an `ContactsProvider` component.'
    );
  }

  return context.contactIndex;
};

export const useContact = (ship: string) => {
  const contactIndex = useContactIndex();
  return contactIndex?.[ship] ?? null;
};

export const useContactGetter = () => {
  const contactIndex = useContactIndex();
  const getFromIndex = useCallback(
    (contactId: string) => contactIndex?.[contactId] ?? null,
    [contactIndex]
  );
  return getFromIndex;
};

export const useBranchDomain = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useBranchDomain` within an `AppDataContextProvider` component.'
    );
  }

  return context.branchDomain;
};

export const useBranchKey = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useBranchKey` within an `AppDataContextProvider` component.'
    );
  }

  return context.branchKey;
};

export const AppDataContextProvider = ({
  children,
  currentUserId,
  contacts,
  branchDomain,
  branchKey,
}: {
  children: ReactNode;
  currentUserId?: string;
  contacts: db.Contact[] | null;
  branchDomain?: string;
  branchKey?: string;
}) => {
  const value = useMemo(
    () => ({
      contacts,
      contactIndex: buildContactIndex(contacts ?? []),
      currentUserId: currentUserId ?? '',
      branchDomain: branchDomain ?? '',
      branchKey: branchKey ?? '',
    }),
    [contacts, currentUserId, branchDomain, branchKey]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

function buildContactIndex(contacts: db.Contact[]) {
  return contacts.reduce(
    (acc, contact) => {
      acc[contact.id] = contact;
      return acc;
    },
    {} as Record<string, db.Contact>
  );
}
