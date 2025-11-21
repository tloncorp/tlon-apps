import * as db from '@tloncorp/shared/db';
import { ConfirmDialog, useIsWindowNarrow } from '@tloncorp/ui';
import React, { useCallback } from 'react';
import { View } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { ScreenHeader } from '../ScreenHeader';
import { Tabs } from '../Tabs';

export type ActivityTab = 'all' | 'threads' | 'mentions';

function ActivityHeaderRaw({
  activeTab,
  onTabPress,
  markAllRead,
}: {
  activeTab: db.ActivityBucket;
  onTabPress: (tab: db.ActivityBucket) => void;
  markAllRead: () => Promise<void>;
}) {
  const [overflowOpen, setOverflowOpen] = React.useState(false);
  const onOverflowOpenChange = useCallback((open: boolean) => {
    console.log('Overflow menu open state changed:', open);
    setOverflowOpen(open);
  }, []);

  return (
    <View>
      <View width="100%">
        <ScreenHeader>
          <ScreenHeader.Title textAlign="center">Activity</ScreenHeader.Title>
          <ScreenHeader.Controls side="right">
            <ActivityOverflowMenu
              open={overflowOpen}
              onOpenChange={onOverflowOpenChange}
              markAllRead={markAllRead}
            />
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

function ActivityOverflowMenu({
  open,
  onOpenChange,
  markAllRead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markAllRead: () => Promise<void>;
}) {
  const [confirmationOpen, setConfirmationOpen] = React.useState(false);
  const isWindowNarrow = useIsWindowNarrow();
  const handleOpenConfirmation = useCallback(() => {
    setConfirmationOpen(true);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    onOpenChange(false);
    await markAllRead();
  }, [onOpenChange, markAllRead]);

  return (
    <ActionSheet
      mode={isWindowNarrow ? 'sheet' : 'popover'}
      modal
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <ScreenHeader.IconButton
          type="Overflow"
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
      <ConfirmDialog
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        title="Mark all as read"
        description="Are you sure you want to mark all conversations and notifications as read?"
        confirmText="Mark all read"
        onConfirm={handleMarkAllRead}
      />
    </ActionSheet>
  );
}
