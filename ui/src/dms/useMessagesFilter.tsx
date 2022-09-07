import create from 'zustand';

export type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Channels';

export const filters: Record<string, SidebarFilter> = {
  dms: 'Direct Messages',
  all: 'All Messages',
  groups: 'Group Channels',
};

interface MessagesFilter {
  filter: SidebarFilter;
  setFilter: (filter: SidebarFilter) => void;
}

const useMessagesFilter = create<MessagesFilter>((set) => ({
  filter: filters.dms,
  setFilter: (filter: SidebarFilter) => {
    set({ filter });
  },
}));

export default useMessagesFilter;
