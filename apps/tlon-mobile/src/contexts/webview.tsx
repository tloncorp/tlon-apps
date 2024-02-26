import type { MobileNavTab } from '@tloncorp/shared';
import { createContext, useContext, useState } from 'react';

export interface WebviewPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WebviewContext {
  visible: boolean;
  position: WebviewPosition;
  gotoPath: string;
  gotoTab: MobileNavTab | null;
  reactingToWebappNav: boolean;
  lastMessagesPath: string;
  lastGroupsPath: string;
  setLastMessagesPath: (path: string) => void;
  setLastGroupsPath: (path: string) => void;
  setReactingToWebappNav: (reacting: boolean) => void;
  setVisibility: (visible: boolean) => void;
  setPosition: (position: WebviewPosition) => void;
  setGotoPath: (gotoPath: string) => void;
  setGotoTab: (gotoTab: MobileNavTab | null) => void;
  clearGotoPath: () => void;
}

const AppWebviewContext = createContext<WebviewContext>({
  visible: false,
  position: { x: 0, y: 0, width: 0, height: 0 },
  gotoPath: '',
  gotoTab: null,
  reactingToWebappNav: false,
  lastMessagesPath: '',
  lastGroupsPath: '',
  setLastGroupsPath: () => {},
  setLastMessagesPath: () => {},
  setReactingToWebappNav: () => {},
  setVisibility: () => {},
  setPosition: () => {},
  setGotoPath: () => {},
  setGotoTab: () => {},
  clearGotoPath: () => {},
});

interface AppWebviewProviderProps {
  children: React.ReactNode;
}

export const WebviewProvider = ({ children }: AppWebviewProviderProps) => {
  const [lastMessagesPath, setLastMessagesPath] = useState('');
  const [lastGroupsPath, setLastGroupsPath] = useState('');
  const [reactingToWebappNav, setReactingToWebappNav] = useState(false);
  const [gotoPath, setGotoPath] = useState('');
  const [gotoTab, setGotoTab] = useState<MobileNavTab | null>(null);
  const [visible, setVisibility] = useState(true);
  const [position, setPosition] = useState<WebviewPosition>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  return (
    <AppWebviewContext.Provider
      value={{
        position,
        visible,
        gotoPath,
        gotoTab,
        reactingToWebappNav,
        lastMessagesPath,
        lastGroupsPath,
        setLastMessagesPath,
        setLastGroupsPath,
        setReactingToWebappNav,
        setPosition,
        setVisibility,
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
