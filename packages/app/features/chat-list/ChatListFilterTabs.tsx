import {
  CHAT_LIST_FILTERS,
  CHAT_LIST_FILTER_LABELS,
  type ChatListFilter,
} from '../../hooks/chatListFilters';
import { Tabs } from '../../ui';

export function ChatListFilterTabs({
  activeFilter,
  onPressFilter,
}: {
  activeFilter: ChatListFilter;
  onPressFilter: (filter: ChatListFilter) => void;
}) {
  return (
    <Tabs>
      {CHAT_LIST_FILTERS.map((filter) => (
        <Tabs.Tab
          key={filter}
          name={filter}
          activeTab={activeFilter}
          onTabPress={onPressFilter}
        >
          <Tabs.Title cursor="pointer" active={activeFilter === filter}>
            {CHAT_LIST_FILTER_LABELS[filter]}
          </Tabs.Title>
        </Tabs.Tab>
      ))}
    </Tabs>
  );
}
