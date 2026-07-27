import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import React, { useCallback } from 'react';
import { View } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { ScreenHeader } from '../ScreenHeader';
import { Tabs } from '../Tabs';

export type ActivityTab = 'all' | 'threads' | 'mentions';

function ActivityHeaderRaw({
  activeTab,
  onTabPress,
  onRequestMarkAllRead,
  subtitle,
  loadingSubtitle,
  showScreenHeader = true,
}: {
  activeTab: db.ActivityBucket;
  onTabPress: (tab: db.ActivityBucket) => void;
  onRequestMarkAllRead: () => void;
  subtitle?: string;
  loadingSubtitle?: string | null;
  showScreenHeader?: boolean;
}) {
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const onOverflowOpenChange = useCallback((open: boolean) => {
    setOverflowOpen(open);
  }, []);

  return (
    <View>
      <View width="100%">
        {showScreenHeader && (
          <ScreenHeader
            title="Activity"
            subtitle={subtitle}
            loadingSubtitle={loadingSubtitle}
          >
            <ScreenHeader.Controls side="right">
              <ActivityOverflowMenu
                open={overflowOpen}
                onOpenChange={onOverflowOpenChange}
                onRequestMarkAllRead={onRequestMarkAllRead}
              />
            </ScreenHeader.Controls>
          </ScreenHeader>
        )}
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

function ActivityOverflowMenu({
  open,
  onOpenChange,
  onRequestMarkAllRead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestMarkAllRead: () => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const handleOpenConfirmation = useCallback(() => {
    onOpenChange(false);
    onRequestMarkAllRead();
  }, [onOpenChange, onRequestMarkAllRead]);

  return (
    <ActionSheet
      mode={isWindowNarrow ? 'sheet' : 'popover'}
      modal
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <OverflowTriggerButton
          onPress={!isWindowNarrow ? undefined : () => onOpenChange(true)}
        />
      }
    >
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent="neutral">
          <ActionSheet.Action
            action={{
              title: 'Mark all as read',
              accent: 'positive',
              action: handleOpenConfirmation,
            }}
          />
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
