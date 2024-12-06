import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import React, { createContext, useContext } from 'react';

type StoreType = typeof store;
type StoreContextType = StoreType;

const logger = createDevLogger('StoreContext', true);

function createNoOpFunction(key: string) {
  return new Proxy(() => {}, {
    apply: () => undefined,
    get: () => createNoOpFunction(`${key}.property`),
  });
}

const StoreContext = createContext<StoreContextType | null>(null);

interface StoreProviderProps {
  children: React.ReactNode;
  stub?: boolean;
}

export function StoreProvider({ children, stub = false }: StoreProviderProps) {
  const storeValue = React.useMemo(() => {
    if (stub) {
      return new Proxy({} as StoreType, {
        get: (target, prop) => {
          logger.log('Mocked store call', prop.toString());
          return createNoOpFunction(prop.toString());
        },
      });
    }
    return store;
  }, [stub]);

  return (
    <StoreContext.Provider value={storeValue}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreType {
  const context = useContext(StoreContext);
  if (context === null) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
