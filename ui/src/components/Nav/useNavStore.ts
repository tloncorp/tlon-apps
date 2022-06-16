import create from 'zustand';

export type NavPrimaryLocation = 'main' | 'dm' | 'group' | 'hidden';
export type NavSecondaryLocation =
  | 'main'
  | 'notifications'
  | 'search'
  | 'group';

interface NavStore {
  primary: NavPrimaryLocation;
  secondary: NavSecondaryLocation;
  flag: string;
  setLocationMain: () => void;
  setLocationHidden: () => void;
  setLocationGroups: (flag: string) => void;
  setLocationDM: () => void;
  navigateSecondary: (loc: NavSecondaryLocation) => void;
}

const useNavStore = create<NavStore>((set) => ({
  primary: 'main',
  secondary: 'main',
  flag: '',
  setLocationMain: () => set({ primary: 'main' }),
  setLocationGroups: (flag) => set({ primary: 'group', flag }),
  setLocationDM: () => set({ primary: 'dm' }),
  setLocationHidden: () => set({ primary: 'hidden' }),
  navigateSecondary: (loc: NavSecondaryLocation) => set({ secondary: loc }),
}));

export default useNavStore;
