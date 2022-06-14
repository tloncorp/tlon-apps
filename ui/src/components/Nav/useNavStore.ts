import create from 'zustand';

interface NavStore {
  location: string;
  flag: string;
  setLocationMain: () => void;
  setLocationGroups: (flag: string) => void;
  setLocationDM: () => void;
}

const useNavStore = create<NavStore>((set) => ({
  location: 'main',
  flag: '',
  setLocationMain: () => set({ location: 'main' }),
  setLocationGroups: (flag) => set({ location: 'group', flag }),
  setLocationDM: () => set({ location: 'dm' }),
}));

export default useNavStore;
