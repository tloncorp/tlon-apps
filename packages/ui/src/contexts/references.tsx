import { ContentReference } from 'packages/shared/dist/api';
import { PropsWithChildren, createContext, useContext, useState } from 'react';

export type ReferencesState = {
  references: Record<string, ContentReference | null>;
  setReferences: (references: Record<string, ContentReference | null>) => void;
};

const defaultState: ReferencesState = {
  references: {},
  setReferences: () => {},
};

const Context = createContext(defaultState);

export const useReferences = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useReferences` within an `ReferencesProvider` component.'
    );
  }

  return context;
};

export const ReferencesProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<Record<string, ContentReference | null>>(
    {}
  );

  return (
    <Context.Provider
      value={{
        references: state,
        setReferences: setState,
      }}
    >
      {children}
    </Context.Provider>
  );
};
