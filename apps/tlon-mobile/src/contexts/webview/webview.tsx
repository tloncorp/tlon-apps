import type { MobileNavTab, NativeCommand } from '@tloncorp/shared';
import { createContext, useContext, useState } from 'react';

export interface WebviewContext {
  gotoPath: string;
  gotoTab: MobileNavTab | null;
  reactingToWebappNav: boolean;
  lastMessagesPath: string;
  pendingCommand: NativeCommand | null;
  didManageAccount: boolean;
  setDidManageAccount: (didManageAccount: boolean) => void;
  sendCommand: (command: NativeCommand) => void;
  setLastMessagesPath: (path: string) => void;
  setReactingToWebappNav: (reacting: boolean) => void;
  setGotoPath: (gotoPath: string) => void;
  setGotoTab: (gotoTab: MobileNavTab | null) => void;
  clearGotoPath: () => void;
}

const AppWebviewContext = createContext<WebviewContext>({
  gotoPath: '',
  gotoTab: null,
  reactingToWebappNav: false,
  lastMessagesPath: '',
  pendingCommand: null,
  didManageAccount: false,
  setDidManageAccount: () => {},
  sendCommand: () => {},
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
  const [pendingCommand, sendCommand] = useState<NativeCommand | null>(null);
  const [lastMessagesPath, setLastMessagesPath] = useState('');
  const [reactingToWebappNav, setReactingToWebappNav] = useState(false);
  const [gotoPath, setGotoPath] = useState('');
  const [gotoTab, setGotoTab] = useState<MobileNavTab | null>(null);
  const [didManageAccount, setDidManageAccount] = useState(false);

  return (
    <AppWebviewContext.Provider
      value={{
        gotoPath,
        gotoTab,
        reactingToWebappNav,
        lastMessagesPath,
        pendingCommand,
        didManageAccount,
        setDidManageAccount,
        sendCommand,
        setLastMessagesPath,
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
