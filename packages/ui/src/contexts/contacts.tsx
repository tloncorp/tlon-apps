import * as db from '@tloncorp/shared/dist/db';
import { createContext, useCallback, useContext, useMemo } from 'react';

type State = {
  contacts: db.Contact[] | null;
  contactIndex: Record<string, db.Contact> | null;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  contacts: null,
  contactIndex: null,
});

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

export const ContactsProvider = ({
  children,
  contacts,
}: {
  children: React.ReactNode;
  contacts: db.Contact[] | null;
}) => {
  const value = useMemo(
    () => ({ contacts, contactIndex: buildContactIndex(contacts ?? []) }),
    [contacts]
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
