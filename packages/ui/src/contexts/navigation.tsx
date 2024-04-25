import * as db from '@tloncorp/shared/dist/db';
import { createContext, useContext, useMemo } from 'react';

type State = {
  navigate: (channel: db.Channel, post: db.Post) => void;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  navigate: () => {},
});

export const useNavigation = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error(
      'Must call `useNavigation` within an `NavigationProvider` component.'
    );
  }
  return context;
};

export const NavigationProvider = ({
  children,
  navigate,
}: {
  children: React.ReactNode;
  navigate: (channel: db.Channel, post: db.Post) => void;
}) => {
  const value = useMemo(() => ({ navigate }), [navigate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
