import { Tabs } from '@tloncorp/ui';

import { TabName } from '../../hooks/useFilteredChats';

export function ChatListTabs({
  activeTab,
  onPressTab,
}: {
  activeTab: TabName;
  onPressTab: (tab: TabName) => void;
}) {
  return (
    <Tabs>
      <Tabs.Tab name="all" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title cursor="pointer" active={activeTab === 'all'}>
          All
        </Tabs.Title>
      </Tabs.Tab>
      <Tabs.Tab name="groups" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title cursor="pointer" active={activeTab === 'groups'}>
          Groups
        </Tabs.Title>
      </Tabs.Tab>
      <Tabs.Tab name="messages" activeTab={activeTab} onTabPress={onPressTab}>
        <Tabs.Title cursor="pointer" active={activeTab === 'messages'}>
          Messages
        </Tabs.Title>
      </Tabs.Tab>
    </Tabs>
  );
}
