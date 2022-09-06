import create from 'zustand';

export type NavPrimaryLocation = 'initial' | 'main' | 'dm' | 'group' | 'hidden';
export type NavSecondaryLocation =
  | 'main'
  | 'notifications'
  | 'search'
  | 'group';

interface NavStore {
  primary: NavPrimaryLocation;
  secondary: NavSecondaryLocation;
  flag: string;
  navigatePrimary: (loc: NavPrimaryLocation, flag?: string) => void;
  navigateSecondary: (loc: NavSecondaryLocation) => void;
}

const useNavStore = create<NavStore>((set) => ({
  primary: 'initial',
  secondary: 'main',
  flag: '',
  navigatePrimary: (loc, flag = '') =>
    set({ primary: loc, secondary: 'main', flag }),
  navigateSecondary: (loc) => set({ secondary: loc }),
}));

export default useNavStore;
