import GroupActions from '@/groups/GroupActions';
import GroupAvatar from '@/groups/GroupAvatar';
import { useGroups } from '@/state/groups';
import React from 'react';
import { useGroupsScrolling } from './GroupsScrollingContext';
import SidebarItem from './SidebarItem';

const GroupsSidebarItem = React.memo(({ flag }: { flag: string }) => {
  const groups = useGroups();
  const group = groups[flag];
  const isScrolling = useGroupsScrolling();

  return (
    <SidebarItem
      icon={
        <GroupAvatar
          size="h-12 w-12 sm:h-6 sm:w-6 rounded-lg sm:rounded"
          {...group?.meta}
          loadImage={!isScrolling}
        />
      }
      actions={<GroupActions flag={flag} />}
      to={`/groups/${flag}`}
    >
      {group?.meta.title}
    </SidebarItem>
  );
});

export default GroupsSidebarItem;
