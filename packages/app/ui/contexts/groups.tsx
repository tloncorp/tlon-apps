import * as db from '@tloncorp/shared/db';
import { createContext, useContext, useMemo } from 'react';

type State = {
  groups: db.Group[] | null;
};

type ContextValue = State;

const Context = createContext<ContextValue>({
  groups: null,
});

export const useGroups = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error(
      'Must call `useGroups` within an `GroupsProvider` component.'
    );
  }
  return context.groups;
};

export const useGroup = (id: string) => {
  const groups = useGroups();
  return groups?.find((group) => group.id === id);
};

export const GroupsProvider = ({
  children,
  groups,
}: {
  children: React.ReactNode;
  groups: db.Group[] | null;
}) => {
  const value = useMemo(() => ({ groups }), [groups]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
