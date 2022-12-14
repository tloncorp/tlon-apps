import React, { useCallback, useState } from 'react';
import cn from 'classnames';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useLocation } from 'react-router';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import CheckIcon from '@/components/icons/CheckIcon';
import ElipsisCircleIcon from '@/components/icons/EllipsisCircleIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import { toTitleCase, getSectTitle } from '@/logic/utils';
import {
  useAmAdmin,
  useGroup,
  useGroupFlag,
  useGroupState,
  useSects,
  useVessel,
} from '@/state/groups';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import { useContact } from '@/state/contact';
import { Status } from '@/logic/status';
import { Vessel } from '@/types/groups';

interface GroupMemberItemProps {
  member: string;
}

function GroupMemberItem({ member }: GroupMemberItemProps) {
  const [sectStatus, setSectStatus] = useState<Status>('initial');
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const sects = useSects(flag);
  const isAdmin = useAmAdmin(flag);
  const vessel = useVessel(flag, member);
  const contact = useContact(member);
  const location = useLocation();
  const modalNavigate = useModalNavigate();

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const kick = useCallback(
    (ship: string) => () => {
      useGroupState.getState().delMembers(flag, [ship]);
    },
    [flag]
  );

  const ban = useCallback(
    (ship: string) => () => {
      useGroupState.getState().banShips(flag, [ship]);
    },
    [flag]
  );

  const toggleSect = useCallback(
    (ship: string, sect: string, v: Vessel) => async (event: Event) => {
      event.preventDefault();

      setSectStatus('loading');

      const inSect = v.sects.includes(sect);
      if (inSect) {
        try {
          await useGroupState.getState().delSects(flag, ship, [sect]);
          setSectStatus('success');
        } catch (e) {
          setSectStatus('error');
          console.error(e);
        }
      } else {
        try {
          await useGroupState.getState().addSects(flag, ship, [sect]);
          setSectStatus('success');
        } catch (e) {
          setSectStatus('error');
          console.log(e);
        }
      }
    },
    [flag]
  );

  if (!group) {
    return null;
  }

  return (
    <>
      <div className="cursor-pointer" onClick={() => onViewProfile(member)}>
        <Avatar ship={member} size="small" className="mr-2" />
      </div>
      <div className="flex flex-1 flex-col">
        <h2>
          {contact?.nickname ? contact.nickname : <ShipName name={member} />}
        </h2>
        {contact?.nickname ? (
          <p className="text-sm text-gray-400">{member}</p>
        ) : null}
      </div>
      {isAdmin && vessel ? (
        <Dropdown.Root>
          <Dropdown.Trigger className="default-focus mr-2 flex items-center rounded px-2 py-1.5 text-gray-400">
            {vessel.sects
              .map((s) => toTitleCase(getSectTitle(group.cabals, s)))
              .join(', ')}
            <CaretDown16Icon className="ml-2 h-4 w-4" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            {sects.map((s) => (
              <Dropdown.Item
                key={s}
                className={cn(
                  'dropdown-item flex items-center',
                  !vessel.sects.includes(s) && 'text-gray-400'
                )}
                onSelect={toggleSect(member, s, vessel)}
              >
                {getSectTitle(group.cabals, s)}
                {sectStatus === 'loading' ? (
                  <LoadingSpinner className="ml-auto h-4 w-4" />
                ) : vessel.sects.includes(s) ? (
                  <CheckIcon className="ml-auto h-6 w-6 text-green" />
                ) : (
                  <div className="ml-auto h-6 w-6" />
                )}
              </Dropdown.Item>
            ))}
            <Dropdown.Item
              className={cn('dropdown-item flex items-center', 'text-gray-400')}
            >
              Member
              <CheckIcon className="ml-auto h-6 w-6 text-green" />
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      ) : null}
      {isAdmin ? (
        <Dropdown.Root>
          {member !== window.our ? (
            <Dropdown.Trigger className="default-focus ml-auto rounded text-gray-400">
              <ElipsisCircleIcon className="h-6 w-6" />
            </Dropdown.Trigger>
          ) : (
            <div className="h-6 w-6" />
          )}

          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            <Dropdown.Item
              className="dropdown-item flex items-center text-red"
              onSelect={kick(member)}
            >
              <LeaveIcon className="mr-2 h-6 w-6" />
              Kick
            </Dropdown.Item>
            <Dropdown.Item
              className="dropdown-item flex items-center text-red"
              onSelect={ban(member)}
            >
              <LeaveIcon className="mr-2 h-6 w-6" />
              Ban
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      ) : (
        <Dropdown.Root>
          <Dropdown.Trigger className="default-focus ml-auto rounded text-gray-400">
            <ElipsisIcon className="h-6 w-6" />
          </Dropdown.Trigger>
          <Dropdown.Content className="dropdown min-w-52 text-gray-800">
            <Dropdown.Item
              className="dropdown-item flex items-center"
              onSelect={() => onViewProfile(member)}
            >
              View Profile
            </Dropdown.Item>
            <Dropdown.Item
              className="dropdown-item flex items-center"
              onSelect={(e) => e.preventDefault}
            >
              Send Message
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Root>
      )}
    </>
  );
}

export default React.memo(GroupMemberItem);
