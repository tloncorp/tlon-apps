import * as db from '@tloncorp/shared/db';
import React from 'react';
import { View } from 'tamagui';

import { ScreenHeader } from '../ScreenHeader';
import { Tabs } from '../Tabs';

export type ActivityTab = 'all' | 'threads' | 'mentions';

function ActivityHeaderRaw({
  activeTab,
  onTabPress,
  hasUnreadNotifications,
  markAllRead,
}: {
  activeTab: db.ActivityBucket;
  onTabPress: (tab: db.ActivityBucket) => void;
  hasUnreadNotifications: boolean;
  markAllRead: () => Promise<void>;
}) {
  return (
    <View>
      <View width="100%">
        <ScreenHeader>
          <ScreenHeader.Title textAlign="center">Activity</ScreenHeader.Title>
          <ScreenHeader.Controls side="right">
            {hasUnreadNotifications && (
              <ScreenHeader.TextButton
                size="$label/m"
                color="$blue"
                onPress={markAllRead}
              >
                Mark all read
              </ScreenHeader.TextButton>
            )}
          </ScreenHeader.Controls>
        </ScreenHeader>
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
