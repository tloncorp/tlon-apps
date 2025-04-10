import { createContext } from 'react';

export const useRegisterSW = (options?: any) => ({
  needRefresh: [false],
  offlineReady: [false],
  updateServiceWorker: async () => {},
});

export default function useAppUpdates() {
  const triggerUpdate = async (returnToRoot: boolean) => {
    // No-op in Electron
    return Promise.resolve();
  };

  return {
    needsUpdate: false,
    triggerUpdate,
  };
}

export const AppUpdateContext = createContext<{
  needsUpdate: boolean;
  triggerUpdate: (returnToRoot: boolean) => Promise<void> | null;
}>({ needsUpdate: false, triggerUpdate: () => null });
