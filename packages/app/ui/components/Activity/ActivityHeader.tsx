import * as db from '@tloncorp/shared/db';
import React from 'react';
import { View } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { Tabs } from '../Tabs';

export type ActivityTab = 'all' | 'threads' | 'mentions';

function ActivityHeaderRaw({
  activeTab,
  onTabPress,
}: {
  activeTab: db.ActivityBucket;
  onTabPress: (tab: db.ActivityBucket) => void;
}) {
  return (
    <View>
      <View width="100%">
        <ScreenHeader title="Activity" />
      </View>
      <Tabs>
        <Tabs.Tab
          activeTab={activeTab}
          onTabPress={() => onTabPress('all')}
          name="all"
        >
          <Tabs.Title cursor="pointer" active={activeTab === 'all'}>
            All
          </Tabs.Title>
        </Tabs.Tab>
        <Tabs.Tab
          activeTab={activeTab}
          onTabPress={() => onTabPress('mentions')}
          name="mentions"
        >
          <Tabs.Title cursor="pointer" active={activeTab === 'mentions'}>
            Mentions
          </Tabs.Title>
        </Tabs.Tab>
        <Tabs.Tab
          activeTab={activeTab}
          onTabPress={() => onTabPress('replies')}
          name="replies"
        >
          <Tabs.Title cursor="pointer" active={activeTab === 'replies'}>
            Replies
          </Tabs.Title>
        </Tabs.Tab>
      </Tabs>
    </View>
  );
}
export const ActivityHeader = React.memo(ActivityHeaderRaw);
