import create from 'zustand';

interface OpenAppsState {
  openApps: string[];
  openApp: (desk: string) => void;
  closeApp: (desk: string) => void;
}

// Tracks which app desks the user has opened during this session, in the
// order they were first opened. Used by the desktop sidebar to render a
// per-app shortcut icon below the "Apps" entry. In-memory only — refreshing
// clears the list.
export const useOpenAppsStore = create<OpenAppsState>((set) => ({
  openApps: [],
  openApp: (desk) =>
    set((s) => (s.openApps.includes(desk)
      ? s
      : { openApps: [...s.openApps, desk] })),
  closeApp: (desk) =>
    set((s) => ({ openApps: s.openApps.filter((d) => d !== desk) })),
}));

export const useOpenApps = () => useOpenAppsStore((s) => s.openApps);
export const useOpenApp = () => useOpenAppsStore((s) => s.openApp);
export const useCloseApp = () => useOpenAppsStore((s) => s.closeApp);
