import React, { useEffect, useMemo, useState } from 'react';

import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import { useGroups } from '@/state/groups';

import { useGroupsScrolling } from './GroupsScrollingContext';
import SidebarItem from './SidebarItem';

const GroupsSidebarItem = React.memo(
  ({ flag, isNew }: { flag: string; isNew?: boolean }) => {
    const isMobile = useIsMobile();
    const groups = useGroups();
    const group = groups[flag];
    const isScrolling = useGroupsScrolling();
    const [optionsOpen, setOptionsOpen] = useState(false);
    const { action, handlers } = useLongPress();
    const disableActions = useMemo(
      () => isMobile || isScrolling,
      [isMobile, isScrolling]
    );
    const enableImages = useMemo(() => !isScrolling, [isScrolling]);

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
            loadImage={enableImages}
          />
        }
        actions={
          isNew ? (
            <GroupActions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              flag={flag}
              triggerDisabled={disableActions}
            >
              <p className="flex items-center rounded-full bg-blue-soft px-2 py-1 text-sm text-blue">
                NEW
              </p>
            </GroupActions>
          ) : (
            <GroupActions
              open={optionsOpen}
              onOpenChange={setOptionsOpen}
              flag={flag}
              triggerDisabled={disableActions}
            />
          )
        }
        to={`/groups/${flag}`}
        {...handlers}
      >
        {group?.meta.title}
      </SidebarItem>
    );
  }
);

export default GroupsSidebarItem;
