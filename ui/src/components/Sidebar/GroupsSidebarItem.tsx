import React, { useEffect, useState } from 'react';
import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import { useHasMigratedChannels } from '@/logic/useMigrationInfo';
import { getFlagParts } from '@/logic/utils';
import { useGroups } from '@/state/groups';
import useLongPress from '@/logic/useLongPress';
import { useIsMobile } from '@/logic/useMedia';
import Bullet16Icon from '../icons/Bullet16Icon';
import MigrationTooltip from '../MigrationTooltip';
import { useGroupsScrolling } from './GroupsScrollingContext';
import SidebarItem from './SidebarItem';

const GroupsSidebarItem = React.memo(({ flag }: { flag: string }) => {
  const isMobile = useIsMobile();
  const groups = useGroups();
  const group = groups[flag];
  const { ship } = getFlagParts(flag);
  const isMigrated = useHasMigratedChannels(flag);
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

  if (!isMigrated) {
    return (
      <MigrationTooltip ship={ship} flag={flag} side="right" kind="group">
        <SidebarItem
          className="opacity-60"
          icon={
            <GroupAvatar
              size="h-12 w-12 sm:h-6 sm:w-6"
              {...group?.meta}
              loadImage={!isScrolling}
            />
          }
          actions={
            <Bullet16Icon
              className="m-2 h-4 w-4 text-orange opacity-60"
              aria-label="Pending Migration"
            />
          }
        >
          {group?.meta.title}
        </SidebarItem>
      </MigrationTooltip>
    );
  }

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
