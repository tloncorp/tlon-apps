import React, { createContext, useContext, useState } from 'react';

interface GlobalSearchContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  lastOpenTab: string;
  setLastOpenTab: (tab: string) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType>({
  isOpen: false,
  setIsOpen: () => {},
  lastOpenTab: 'Home',
  setLastOpenTab: () => {},
});

export function GlobalSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastOpenTab, setLastOpenTab] = useState('Home');

  return (
    <GlobalSearchContext.Provider
      value={{ isOpen, setIsOpen, lastOpenTab, setLastOpenTab }}
    >
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  return useContext(GlobalSearchContext);
}
