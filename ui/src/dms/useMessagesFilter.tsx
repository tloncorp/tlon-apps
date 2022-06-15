import create from 'zustand';

export type SidebarFilter =
  | 'Direct Messages'
  | 'All Messages'
  | 'Group Talk Channels';

export const filters: Record<string, SidebarFilter> = {
  dms: 'Direct Messages',
  all: 'All Messages',
  groups: 'Group Talk Channels',
};

interface MessagesFilter {
  filter: SidebarFilter;
  setFilter: (filter: SidebarFilter) => void;
}

const useMessagesFilter = create<MessagesFilter>((set) => ({
  filter: filters.all,
  setFilter: (filter: SidebarFilter) => {
    set({ filter });
  },
}));

export default useMessagesFilter;
