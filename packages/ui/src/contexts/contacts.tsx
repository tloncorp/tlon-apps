import * as db from '@tloncorp/shared/dist/db';
import { createContext, useContext, useState } from 'react';

type State = {
  contacts: db.Contact[];
};

type ContextValue = State & {
  setContacts: (contacts: db.Contact[]) => void;
};

const defaultContacts: db.Contact[] = [];

const defaultState: State = {
  contacts: defaultContacts,
};

const Context = createContext<ContextValue>({
  ...defaultState,
  setContacts: () => {},
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
  return contacts?.find((contact) => contact.id === ship) || undefined;
};

export const ContactsProvider = ({
  children,
  initialContacts,
}: {
  children: React.ReactNode;
  initialContacts: db.Contact[];
}) => {
  const [state, setState] = useState<db.Contact[]>(initialContacts);

  const setContacts = (contacts: db.Contact[]) => {
    setState(contacts);
  };

  console.log({
    contacts: [...state],
    initialContacts,
  });

  return (
    <Context.Provider value={{ contacts: [...initialContacts], setContacts }}>
      {children}
    </Context.Provider>
  );
};
