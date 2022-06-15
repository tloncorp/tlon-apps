import cn from 'classnames';
import React from 'react';
import useSidebarSort from '../../logic/useSidebarSort';
import { useGangList, useGroup, useGroupList } from '../../state/groups';
import Divider from '../Divider';
import GangName from '../GangName/GangName';
import GroupAvatar from '../GroupAvatar';
import useNavStore from '../Nav/useNavStore';
import GroupActions from './GroupActions';
import SidebarItem from './SidebarItem';

function GroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const setNavGroups = useNavStore((state) => state.setLocationGroups);
  return (
    <SidebarItem
      icon={
        <GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" img={group?.meta.image} />
      }
      actions={<GroupActions flag={flag} />}
      onClick={() => setNavGroups(flag)}
    >
      {group?.meta.title}
    </SidebarItem>
  );
}

// Gang is a pending group invite
function GangItem(props: { flag: string }) {
  const { flag } = props;
  const hideNav = useNavStore((state) => state.setLocationHidden);
  return (
    <SidebarItem
      icon={<GroupAvatar size="h-12 w-12 sm:h-6 sm:w-6" />}
      to={`/gangs/${flag}`}
      onClick={hideNav}
    >
      <GangName flag={flag} className="inline-block w-full truncate" />
    </SidebarItem>
  );
}

interface GroupListProps {
  className?: string;
}

export default function GroupList({ className }: GroupListProps) {
  const flags = useGroupList();
  const gangs = useGangList();
  const { sortFn, sortOptions } = useSidebarSort();

  return (
    <ul className={cn('h-full space-y-3 p-2 sm:space-y-0', className)}>
      {flags.sort(sortOptions[sortFn]).map((flag) => (
        <GroupItem key={flag} flag={flag} />
      ))}
      {gangs.length > 0 ? <Divider>Pending</Divider> : null}
      {gangs.map((flag) => (
        <GangItem key={flag} flag={flag} />
      ))}
    </ul>
  );
}
