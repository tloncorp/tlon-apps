import React, { createContext, useContext, useState } from 'react';

interface GlobalSearchContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextType>({
  isOpen: false,
  setIsOpen: () => {},
});

export function GlobalSearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GlobalSearchContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </GlobalSearchContext.Provider>
  );
}

export function useGlobalSearch() {
  return useContext(GlobalSearchContext);
}
