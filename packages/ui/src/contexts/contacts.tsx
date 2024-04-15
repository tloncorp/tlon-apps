import * as db from '@tloncorp/shared/dist/db';
import { createContext, useContext, useMemo, useState } from 'react';

type State = {
  contacts: db.Contact[] | null;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  contacts: null,
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

export const useContact = (ship: string) => {
  const contacts = useContacts();
  return contacts?.find((contact) => contact.id === ship);
};

export const ContactsProvider = ({
  children,
  contacts,
}: {
  children: React.ReactNode;
  contacts: db.Contact[] | null;
}) => {
  const value = useMemo(() => ({ contacts }), [contacts]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
