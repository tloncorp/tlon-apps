import * as db from '@tloncorp/shared/dist/db';
import { createContext, useContext, useState } from 'react';

type State = {
  groups: db.GroupWithRelations[];
};

type ContextValue = State & {
  setGroups: (groups: db.GroupWithRelations[]) => void;
};

const defaultGroups: db.GroupWithRelations[] = [];

const defaultState: State = {
  groups: defaultGroups,
};

const Context = createContext<ContextValue>({
  ...defaultState,
  setGroups: () => {},
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
  initialGroups,
}: {
  children: React.ReactNode;
  initialGroups: db.GroupWithRelations[];
}) => {
  const [state, setState] = useState<db.GroupWithRelations[]>(initialGroups);

  const setGroups = (groups: db.GroupWithRelations[]) => {
    setState(groups);
  };

  return (
    <Context.Provider value={{ groups: [...initialGroups], setGroups }}>
      {children}
    </Context.Provider>
  );
};
