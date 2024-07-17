import { ReactNode, createContext, useContext } from 'react';

export type CurrentUserState = string;

const defaultState: CurrentUserState = '';

const Context = createContext(defaultState);

export const useCurrentUserContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useCurrentUser` within an `CurrentUserProvider` component.'
    );
  }

  return context;
};

export const CurrentUserProvider = ({
  children,
  currentUserId,
}: {
  children: ReactNode;
  currentUserId: string;
}) => {
  return <Context.Provider value={currentUserId}>{children}</Context.Provider>;
};
