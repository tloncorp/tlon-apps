import React, { createContext, useContext, useMemo, useState } from 'react';

interface GlobalSearchContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  lastOpenTab: 'Home' | 'Messages';
  setLastOpenTab: (tab: 'Home' | 'Messages') => void;
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
  const [lastOpenTab, setLastOpenTab] = useState<'Home' | 'Messages'>('Home');
  const providerValue = useMemo(
    () => ({ isOpen, setIsOpen, lastOpenTab, setLastOpenTab }),
    [isOpen, setIsOpen, lastOpenTab, setLastOpenTab]
  );

  return (
    <GlobalSearchContext.Provider value={providerValue}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  return useContext(GlobalSearchContext);
}
