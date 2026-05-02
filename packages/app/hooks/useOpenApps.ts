import create from 'zustand';

interface OpenAppsState {
  // Desks the user has opened during this session, in first-open order.
  openApps: string[];
  // The desk currently being rendered in AppViewer (null when on the
  // launcher or any non-app screen). Used to drive sidebar active state
  // without having to introspect nested drawer navigation state — the
  // AppViewer screen sets this via useFocusEffect.
  focusedDesk: string | null;
  openApp: (desk: string) => void;
  closeApp: (desk: string) => void;
  setFocusedDesk: (desk: string | null) => void;
}

export const useOpenAppsStore = create<OpenAppsState>((set) => ({
  openApps: [],
  focusedDesk: null,
  openApp: (desk) =>
    set((s) => (s.openApps.includes(desk)
      ? s
      : { openApps: [...s.openApps, desk] })),
  closeApp: (desk) =>
    set((s) => ({
      openApps: s.openApps.filter((d) => d !== desk),
      focusedDesk: s.focusedDesk === desk ? null : s.focusedDesk,
    })),
  setFocusedDesk: (desk) => set({ focusedDesk: desk }),
}));

export const useOpenApps = () => useOpenAppsStore((s) => s.openApps);
export const useOpenApp = () => useOpenAppsStore((s) => s.openApp);
export const useCloseApp = () => useOpenAppsStore((s) => s.closeApp);
export const useFocusedDesk = () => useOpenAppsStore((s) => s.focusedDesk);
export const useSetFocusedDesk = () =>
  useOpenAppsStore((s) => s.setFocusedDesk);
