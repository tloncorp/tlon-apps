import type { MobileNavTab, NativeCommand } from '@tloncorp/shared';
import { createContext, useContext, useState } from 'react';

type ManageAccountState = 'initial' | 'triggered' | 'navigated';

export interface WebviewContext {
  appLoaded: boolean;
  gotoPath: string;
  gotoTab: MobileNavTab | null;
  reactingToWebappNav: boolean;
  lastMessagesPath: string;
  lastGroupsPath: string;
  pendingCommand: NativeCommand | null;
  manageAccountState: ManageAccountState;
  setAppLoaded: (isLoaded: boolean) => void;
  setManageAccountState: (didManageAccount: ManageAccountState) => void;
  sendCommand: (command: NativeCommand) => void;
  setLastMessagesPath: (path: string) => void;
  setLastGroupsPath: (path: string) => void;
  setReactingToWebappNav: (reacting: boolean) => void;
  setGotoPath: (gotoPath: string) => void;
  setGotoTab: (gotoTab: MobileNavTab | null) => void;
  clearGotoPath: () => void;
}

const AppWebviewContext = createContext<WebviewContext>({
  appLoaded: false,
  gotoPath: '',
  gotoTab: null,
  reactingToWebappNav: false,
  lastMessagesPath: '',
  lastGroupsPath: '',
  pendingCommand: null,
  manageAccountState: 'initial',
  setAppLoaded: () => {},
  setManageAccountState: () => {},
  sendCommand: () => {},
  setLastGroupsPath: () => {},
  setLastMessagesPath: () => {},
  setReactingToWebappNav: () => {},
  setGotoPath: () => {},
  setGotoTab: () => {},
  clearGotoPath: () => {},
});

interface AppWebviewProviderProps {
  children: React.ReactNode;
}

export const WebviewProvider = ({ children }: AppWebviewProviderProps) => {
  const [appLoaded, setAppLoaded] = useState(false);
  const [pendingCommand, sendCommand] = useState<NativeCommand | null>(null);
  const [lastMessagesPath, setLastMessagesPath] = useState('');
  const [lastGroupsPath, setLastGroupsPath] = useState('');
  const [reactingToWebappNav, setReactingToWebappNav] = useState(false);
  const [gotoPath, setGotoPath] = useState('');
  const [gotoTab, setGotoTab] = useState<MobileNavTab | null>(null);
  const [manageAccountState, setManageAccountState] =
    useState<ManageAccountState>('initial');

  return (
    <AppWebviewContext.Provider
      value={{
        appLoaded,
        gotoPath,
        gotoTab,
        reactingToWebappNav,
        lastMessagesPath,
        lastGroupsPath,
        pendingCommand,
        manageAccountState,
        setAppLoaded,
        setManageAccountState,
        sendCommand,
        setLastMessagesPath,
        setLastGroupsPath,
        setReactingToWebappNav,
        setGotoPath,
        setGotoTab,
        clearGotoPath: () => setGotoPath(''),
      }}
    >
      {children}
    </AppWebviewContext.Provider>
  );
};

export const useWebViewContext = () => useContext(AppWebviewContext);
