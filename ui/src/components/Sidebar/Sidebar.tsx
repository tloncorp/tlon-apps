import classNames from 'classnames';
import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useIsMobile } from '../../logic/useMedia';
import { useGangList, useGroup, useGroupList } from '../../state/groups';
import useNavStore from '../Nav/useNavStore';
import Divider from '../Divider';
import GangName from '../GangName/GangName';
import AsteriskIcon from '../icons/AsteriskIcon';
import MagnifyingGlass from '../icons/MagnifyingGlass';
import NotificationLink from './NotificationLink';
import SidebarButton from './SidebarButton';
import SidebarLink from './SidebarLink';
import CaretDownIcon from '../icons/CaretDownIcon';
import AddIcon16 from '../icons/AddIcon16';
import useSidebarSort from '../../logic/useSidebarSort';
import GroupActions from './GroupActions';

function GroupItem({ flag }: { flag: string }) {
  const group = useGroup(flag);
  const setNavGroups = useNavStore((state) => state.setLocationGroups);
  return (
    <SidebarButton
      onClick={() => setNavGroups(flag)}
      className="group"
      actions={<GroupActions flag={flag} />}
    >
      {group?.meta.title}
    </SidebarButton>
  );
}

// Gang is a pending group invite
function GangItem(props: { flag: string }) {
  const { flag } = props;
  return (
    <SidebarLink to={`/gangs/${flag}`}>
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
        <ul className="p-2">
          <NotificationLink
            count={notificationCount}
            title={'Notifications'}
            to={'/notifications'}
          />
          <SidebarLink
            icon={<MagnifyingGlass className="h-6 w-6" />}
            to="/search"
          >
            Search My Groups
          </SidebarLink>
          <SidebarLink
            color="text-blue"
            icon={<AsteriskIcon className="h-6 w-6 p-1.5" />}
            to="/groups/join"
          >
            Join Group
          </SidebarLink>
          <SidebarLink
            color="text-green"
            icon={<AddIcon16 className="h-6 w-6 p-1.5" />}
            to="/groups/new"
          >
            Create Group
          </SidebarLink>

          <li className="my-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                className={'default-focus rounded-lg p-0.5 text-gray-600'}
                aria-label="Groups Sort Options"
              >
                <div className="default-focus flex items-center space-x-2 rounded-lg bg-gray-50 p-2 text-base font-semibold">
                  <span className="pl-1">{`All Groups: ${sortFn}`}</span>
                  <CaretDownIcon className="w-4 text-gray-400" />
                </div>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="dropdown">
                <DropdownMenu.Item
                  disabled
                  className="dropdown-item flex items-center space-x-2 text-gray-300"
                >
                  Group Ordering
                </DropdownMenu.Item>
                {Object.keys(sortOptions).map((k) => (
                  <DropdownMenu.Item
                    key={k}
                    onSelect={() => setSortFn(k)}
                    className="dropdown-item flex items-center space-x-2"
                  >
                    {k}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </li>

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
