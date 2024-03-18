import type { MobileNavTab, NativeCommand } from '@tloncorp/shared';
import { createContext, useContext, useState } from 'react';

type ManageAccountState = 'initial' | 'triggered' | 'navigated';

export interface WebviewContext {
  // fired when the web app has finished loading and is ready to display
  appLoaded: boolean;
  setAppLoaded: (isLoaded: boolean) => void;

  // path the webapp should navigate to
  gotoPath: string;
  setGotoPath: (gotoPath: string) => void;
  clearGotoPath: () => void;

  // tab native we need to navigate to in response to web app navigation
  newWebappTab: MobileNavTab | null;
  setNewWebappTab: (gotoTab: MobileNavTab | null) => void;
  reactingToWebappNav: boolean;
  setReactingToWebappNav: (reacting: boolean) => void;

  // last location tracking for groups and messages tabs. Allows you
  // to pickup where you left off when you navigate back to the tab
  lastMessagesPath: string;
  lastGroupsPath: string;
  setLastMessagesPath: (path: string) => void;
  setLastGroupsPath: (path: string) => void;

  // ipc between web app and native
  pendingCommand: NativeCommand | null;
  sendCommand: (command: NativeCommand) => void;

  // handle account management flow which can be triggered from the web app
  manageAccountState: ManageAccountState;
  setManageAccountState: (didManageAccount: ManageAccountState) => void;
}

const AppWebviewContext = createContext<WebviewContext>({
  appLoaded: false,
  gotoPath: '',
  newWebappTab: null,
  reactingToWebappNav: false,
  lastMessagesPath: '',
  lastGroupsPath: '',
  pendingCommand: null,
  manageAccountState: 'initial',
  setAppLoaded: () => {},
  setManageAccountState: () => {},
  sendCommand: () => {},
  setLastMessagesPath: () => {},
  setLastGroupsPath: () => {},
  setReactingToWebappNav: () => {},
  setGotoPath: () => {},
  setNewWebappTab: () => {},
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
  const [newWebappTab, setNewWebappTab] = useState<MobileNavTab | null>(null);
  const [manageAccountState, setManageAccountState] =
    useState<ManageAccountState>('initial');

  return (
    <AppWebviewContext.Provider
      value={{
        appLoaded,
        gotoPath,
        newWebappTab,
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
        setNewWebappTab,
        clearGotoPath: () => setGotoPath(''),
      }}
    >
      {children}
    </AppWebviewContext.Provider>
  );
};

export const useWebViewContext = () => useContext(AppWebviewContext);
