import { changeMessageFilter, useMessagesFilter } from '@tloncorp/shared/store';
import { TalkSidebarFilter } from '@tloncorp/api/urbit';
import { PropsWithChildren, useCallback, useMemo, useState } from 'react';

import { ActionSheet, createActionGroups } from '../../ui';

export function MessagesFilterMenu({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useMessagesFilter();
  const talkFilter = data ?? 'Direct Messages';

  const handleAction = useCallback((value: TalkSidebarFilter) => {
    return () => {
      changeMessageFilter(value);
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
