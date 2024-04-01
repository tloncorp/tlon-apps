import * as client from '@tloncorp/shared/dist/client';
import { createContext, useContext, useState } from 'react';

type Contacts = {
  [key: string]: client.Contact;
};

type State = {
  contacts: Contacts;
};

type ContextValue = State & {
  setContacts: (contacts: Contacts) => void;
};

const defaultContacts: Contacts = {};

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
  return contacts[ship];
};

export const ContactsProvider = ({
  children,
  initialContacts = defaultContacts,
}: {
  children: React.ReactNode;
  initialContacts: Contacts;
}) => {
  const [state, setState] = useState<Contacts>(initialContacts);

  const setContacts = (contacts: Contacts) => {
    setState(contacts);
  };

  return (
    <Context.Provider value={{ contacts: { ...state }, setContacts }}>
      {children}
    </Context.Provider>
  );
};
