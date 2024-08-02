import * as db from '@tloncorp/shared/dist/db';
import { createContext, useContext, useMemo } from 'react';

type State = {
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  onPressGroupRef: (group: db.Group) => void;
  onPressGoToDm: (participants: string[]) => void;
  onGoToUserProfile: (userId: string) => void;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  onPressRef: () => {},
  onPressGroupRef: () => {},
  onPressGoToDm: () => {},
  onGoToUserProfile: () => {},
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
  onPressRef,
  onPressGroupRef,
  onPressGoToDm,
  onGoToUserProfile,
}: {
  children: React.ReactNode;
  onPressRef: (channel: db.Channel, post: db.Post) => void;
  onPressGroupRef: (group: db.Group) => void;
  onPressGoToDm: (participants: string[]) => void;
  onGoToUserProfile: (userId: string) => void;
}) => {
  const value = useMemo(
    () => ({ onPressRef, onPressGroupRef, onPressGoToDm, onGoToUserProfile }),
    [onPressRef, onPressGroupRef, onPressGoToDm, onGoToUserProfile]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
