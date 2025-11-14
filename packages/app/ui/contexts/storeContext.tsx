import { createDevLogger } from '@tloncorp/shared';
import * as store from '@tloncorp/shared/store';
import React, { createContext, useContext } from 'react';

type StoreType = typeof store;
type StoreContextType = StoreType;
type NoOpFunction = (() => void) & { [key: string]: NoOpFunction };

const logger = createDevLogger('StoreContext', true);

function createNoOpFunction(key: string): NoOpFunction {
  return new Proxy(() => {}, {
    apply: () => undefined,
    get: () => createNoOpFunction(`${key}.property`),
  }) as unknown as NoOpFunction;
}

export function createNoOpStore(): StoreType {
  return new Proxy({} as StoreType, {
    get: (target, prop) => {
      logger.log('Mocked store call', prop.toString());
      return createNoOpFunction(prop.toString());
    },
  });
}

const StoreContext = createContext<StoreContextType | null>(null);

interface StoreProviderProps {
  children: React.ReactNode;
  stub?: boolean | StoreContextType;
}

export function StoreProvider({ children, stub = false }: StoreProviderProps) {
  const storeValue = React.useMemo(() => {
    if (stub === true) {
      return createNoOpStore();
    } else if (typeof stub !== 'boolean' && stub != null) {
      return stub;
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
