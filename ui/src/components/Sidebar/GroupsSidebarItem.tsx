import React, { useEffect, useState } from 'react';
import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import { useGroups } from '@/state/groups';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import { useGroupsScrolling } from './GroupsScrollingContext';
import SidebarItem from './SidebarItem';

const GroupsSidebarItem = React.memo(({ flag }: { flag: string }) => {
  const isMobile = useIsMobile();
  const groups = useGroups();
  const group = groups[flag];
  const isScrolling = useGroupsScrolling();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { action, handlers } = useLongPress();

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (action === 'longpress') {
      setOptionsOpen(true);
    }
  }, [action, isMobile]);

  return (
    <SidebarItem
      icon={
        <GroupAvatar
          size="h-12 w-12 sm:h-6 sm:w-6 rounded-lg sm:rounded"
          {...group?.meta}
          loadImage={!isScrolling}
        />
      }
      actions={
        <GroupActions
          open={optionsOpen}
          onOpenChange={setOptionsOpen}
          flag={flag}
          triggerDisabled={isMobile}
        />
      }
      to={`/groups/${flag}`}
      {...handlers}
    >
      {group?.meta.title}
    </SidebarItem>
  );
});

export default GroupsSidebarItem;
