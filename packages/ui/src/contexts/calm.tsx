import { ReactNode, createContext, useContext, useState } from 'react';

export type CalmState = {
  disableAppTileUnreads: boolean;
  disableAvatars: boolean;
  disableRemoteContent: boolean;
  disableSpellcheck: boolean;
  disableNicknames: boolean;
};

type ContextValue = CalmState & {
  setDisableAppTileUnreads: (disableAppTileUnreads: boolean) => void;
  setDisableAvatars: (disableAvatars: boolean) => void;
  setDisableRemoteContent: (disableRemoteContent: boolean) => void;
  setDisableSpellcheck: (disableSpellcheck: boolean) => void;
  setDisableNicknames: (disableNicknames: boolean) => void;
};

const defaultState: CalmState = {
  disableAppTileUnreads: false,
  disableAvatars: false,
  disableRemoteContent: false,
  disableSpellcheck: false,
  disableNicknames: false,
};

const Context = createContext({
  ...defaultState,
  setDisableAppTileUnreads: () => {},
  setDisableAvatars: () => {},
  setDisableRemoteContent: () => {},
  setDisableSpellcheck: () => {},
  setDisableNicknames: () => {},
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
  initialCalm = defaultState,
}: {
  children: ReactNode;
  initialCalm: CalmState;
}) => {
  const [state, setState] = useState<CalmState>(initialCalm);

  const updateState = (key: keyof CalmState, value: boolean) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Context.Provider
      value={{
        ...state,
        setDisableAppTileUnreads: (disableAppTileUnreads) =>
          updateState('disableAppTileUnreads', disableAppTileUnreads),
        setDisableAvatars: (disableAvatars) =>
          updateState('disableAvatars', disableAvatars),
        setDisableRemoteContent: (disableRemoteContent) =>
          updateState('disableRemoteContent', disableRemoteContent),
        setDisableSpellcheck: (disableSpellcheck) =>
          updateState('disableSpellcheck', disableSpellcheck),
        setDisableNicknames: (disableNicknames) =>
          updateState('disableNicknames', disableNicknames),
      }}
    >
      {children}
    </Context.Provider>
  );
};
