import classNames from 'classnames';
import React from 'react';
import { useIsMobile } from '../../logic/useMedia';
import { useGangList, useGroup, useGroupList } from '../../state/groups';
import useNavStore from '../Nav/useNavStore';
import Divider from '../Divider';
import GangName from '../GangName/GangName';
import AsteriskIcon from '../icons/Asterisk16Icon';
import MagnifyingGlass from '../icons/MagnifyingGlass16Icon';
import SidebarButton from './SidebarButton';
import SidebarLink from './SidebarLink';
import AddIcon16 from '../icons/Add16Icon';
import useSidebarSort from '../../logic/useSidebarSort';
import SidebarSorter from './SidebarSorter';
import ActivityIndicator from './ActivityIndicator';
import GroupAvatar from '../GroupAvatar';

function GroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const setNavGroups = useNavStore((state) => state.setLocationGroups);
  return (
    <SidebarButton
      icon={<GroupAvatar img={group?.meta.image} />}
      onClick={() => setNavGroups(flag)}
    >
      {group?.meta.title}
    </SidebarButton>
  );
}

// Gang is a pending group invite
function GangItem(props: { flag: string }) {
  const { flag } = props;
  return (
    <SidebarLink icon={<GroupAvatar />} to={`/gangs/${flag}`}>
      <GangName flag={flag} />
    </SidebarLink>
  );
}

export default function Sidebar() {
  const flags = useGroupList();
  const gangs = useGangList();
  const isMobile = useIsMobile();
  const { sortFn, setSortFn, sortOptions } = useSidebarSort();
  // TODO: get notification count from hark store
  const notificationCount = 0;

  return (
    <nav className="h-full">
      <div
        className={classNames(
          'h-full border-r-2 border-gray-50 bg-white',
          !isMobile && 'w-64',
          isMobile && 'fixed top-0 left-0 z-40 w-full'
        )}
      >
        {isMobile ? (
          <header className="px-2 py-1">
            <SidebarSorter
              sortFn={sortFn}
              setSortFn={setSortFn}
              sortOptions={sortOptions}
              isMobile={isMobile}
            />
          </header>
        ) : null}
        <ul className="p-2">
          <SidebarLink
            icon={<ActivityIndicator count={notificationCount} />}
            to={`/notifications`}
          >
            Notifications
          </SidebarLink>
          <SidebarLink
            icon={<MagnifyingGlass className="m-1 h-4 w-4" />}
            to="/search"
          >
            Search My Groups
          </SidebarLink>
          <SidebarLink
            color="text-blue"
            icon={<AsteriskIcon className="m-1 h-4 w-4" />}
            to="/groups/join"
          >
            Join Group
          </SidebarLink>
          <SidebarLink
            color="text-green"
            icon={<AddIcon16 className="m-1 h-4 w-4" />}
            to="/groups/new"
          >
            Create Group
          </SidebarLink>

          {!isMobile ? (
            <li className="p-2">
              <SidebarSorter
                sortFn={sortFn}
                setSortFn={setSortFn}
                sortOptions={sortOptions}
                isMobile={isMobile}
              />
            </li>
          ) : null}

          {flags.sort(sortOptions[sortFn]).map((flag) => (
            <GroupItem key={flag} flag={flag} />
          ))}
          {gangs.length > 0 ? <Divider>Pending</Divider> : null}
          {gangs.map((flag) => (
            <GangItem key={flag} flag={flag} />
          ))}
        </ul>
      </div>
    </nav>
  );
}
