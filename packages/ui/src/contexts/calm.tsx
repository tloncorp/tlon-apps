import { ReactNode, createContext, useContext } from 'react';

export type CalmState = {
  disableAvatars: boolean;
  disableRemoteContent: boolean;
  disableNicknames: boolean;
};

type ContextValue = CalmState;

const defaultState: CalmState = {
  disableAvatars: false,
  disableRemoteContent: false,
  disableNicknames: false,
};

const Context = createContext({
  ...defaultState,
} as ContextValue);

export const useCalm = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error('Must call `useCalm` within an `CalmProvider` component.');
  }

  return context;
};

export const CalmProvider = ({
  children,
  calmSettings,
}: {
  children: ReactNode;
  calmSettings?: CalmState;
}) => {
  return (
    <Context.Provider value={calmSettings ?? defaultState}>
      {children}
    </Context.Provider>
  );
};
