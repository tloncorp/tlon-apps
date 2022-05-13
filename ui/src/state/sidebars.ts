import create from 'zustand';
import useMedia from '../logic/useMedia';

type SidebarState = 'closed' | 'channels-open' | 'groups-open';

interface UseSidebarsStore {
  status: SidebarState;
  transition: (newState: SidebarState) => void;
}

const useSidebarsStore = create<UseSidebarsStore>((set) => ({
  status: 'closed',
  transition: (newState) => set({ status: newState }),
}));

export default function useSidebars() {
  const store = useSidebarsStore();
  const isMobile = useMedia('(max-width: 639px)');

  return {
    ...store,
    groupsOpen: !isMobile || (isMobile && store.status === 'groups-open'),
    channelsOpen: !isMobile || (isMobile && store.status === 'channels-open'),
    isMobile,
  };
}
