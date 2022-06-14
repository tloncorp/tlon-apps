import create from 'zustand';

type NavPrimaryLocation = 'main' | 'dm' | 'group' | 'hidden';
type NavSecondaryLocation = 'main' | 'notifications' | 'search' | 'all' | '';

interface NavStore {
  primary: NavPrimaryLocation;
  secondary: NavSecondaryLocation;
  flag: string;
  setLocationMain: () => void;
  setLocationHidden: () => void;
  setLocationGroups: (flag: string) => void;
  setLocationDM: (flag?: string) => void;
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
