import { Popover } from '@tamagui/popover';
import * as store from '@tloncorp/shared/store';
import { TalkSidebarFilter } from '@tloncorp/shared/urbit';
import { ActionSheet, createActionGroups } from '@tloncorp/ui';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';

export function MessagesFilterMenu({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const currentUserId = useCurrentUserId();
  const { data } = store.useMessagesFilter({ userId: currentUserId });
  const talkFilter = data ?? 'Direct Messages';

  const handleAction = useCallback((value: TalkSidebarFilter) => {
    return () => {
      store.changeMessageFilter(value, currentUserId);
      setIsOpen(false);
    };
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsOpen(nextOpen);
    },
    [setIsOpen]
  );

  const actionGroups = useMemo(() => {
    return createActionGroups([
      'neutral',
      {
        title: 'Direct Messages',
        action: handleAction('Direct Messages'),
        selected: talkFilter === 'Direct Messages',
      },
      {
        title: 'Chat Channels',
        action: handleAction('Group Channels'),
        selected: talkFilter === 'Group Channels',
      },
      {
        title: 'All Messages',
        action: handleAction('All Messages'),
        selected: talkFilter === 'All Messages',
      },
    ]);
  }, [handleAction, talkFilter]);

  return (
    <ActionSheet
      open={isOpen}
      onOpenChange={handleOpenChange}
      mode="popover"
      trigger={children}
    >
      <ActionSheet.ScrollableContent width={240}>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}
