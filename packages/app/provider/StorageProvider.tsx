import { StorageContext } from '@tloncorp/shared';
import { ReactNode } from 'react';

import storage from '../lib/storage';

export function StorageProvider({ children }: { children: ReactNode }) {
  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  );
}
