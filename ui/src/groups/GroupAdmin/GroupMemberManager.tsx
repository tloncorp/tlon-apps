import cn from 'classnames';
import React, { useCallback } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import Avatar from '../../components/Avatar';
import ShipName from '../../components/ShipName';
import { useContacts } from '../../state/contact';
import {
  useAmAdmin,
  useGroup,
  useGroupState,
  useRouteGroup,
} from '../../state/groups/groups';
import ElipsisCircleIcon from '../../components/icons/EllipsisCircleIcon';
import LeaveIcon from '../../components/icons/LeaveIcon';
import CheckIcon from '../../components/icons/CheckIcon';
import CaretDown16Icon from '../../components/icons/CaretDown16Icon';
import { getSectTitle } from '../../logic/utils';
import { Vessel } from '../../types/groups';

export default function GroupMemberManager() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const contacts = useContacts();

  console.log(group);

  const toggleSect = useCallback(
    (ship: string, sect: string, vessel: Vessel) => (event: Event) => {
      event.preventDefault();

      const inSect = vessel.sects.includes(sect);
      if (inSect) {
        useGroupState.getState().delSects(flag, ship, [sect]);
      } else {
        useGroupState.getState().addSects(flag, ship, [sect]);
      }
    },
    [flag]
  );

  const kick = useCallback(
    (ship: string) => () => {
      useGroupState.getState().delMember(flag, ship);
    },
    [flag]
  );

  const ban = useCallback(
    (ship: string) => () => {
      useGroupState.getState().banShips(flag, [ship]);
    },
    [flag]
  );

  if (!group) {
    return null;
  }

  const sects = Object.keys(group.cabals);
  const members = Object.keys(group.fleet);

  return (
    <div className="card">
      <h1 className="text-lg font-bold">Members</h1>
      <p className="mb-4 text-sm font-semibold text-gray-400">
        {members.length} total
      </p>
      <ul className="space-y-6 py-2">
        {members.map((m) => {
          const vessel = group.fleet[m];
          return (
            <li key={m} className="flex items-center font-semibold">
              <Avatar ship={m} size="small" className="mr-2" />
              <div className="flex flex-1 flex-col">
                <h2>
                  {contacts[m]?.nickname ? (
                    contacts[m].nickname
                  ) : (
                    <ShipName name={m} />
                  )}
                </h2>
                {contacts[m]?.nickname ? (
                  <p className="text-sm text-gray-400">{m}</p>
                ) : null}
              </div>
              {isAdmin && vessel ? (
                <Dropdown.Root>
                  <Dropdown.Trigger className="default-focus mr-2 flex items-center rounded px-2 py-1.5 text-gray-400">
                    {vessel.sects
                      .map((s) => getSectTitle(group.cabals, s))
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
                        onSelect={toggleSect(m, s, vessel)}
                      >
                        {getSectTitle(group.cabals, s)}
                        {vessel.sects.includes(s) ? (
                          <CheckIcon className="ml-auto h-6 w-6 text-green" />
                        ) : (
                          <div className="ml-auto h-6 w-6" />
                        )}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Content>
                </Dropdown.Root>
              ) : null}
              {isAdmin ? (
                <Dropdown.Root>
                  <Dropdown.Trigger className="default-focus ml-auto rounded text-gray-400">
                    <ElipsisCircleIcon className="h-6 w-6" />
                  </Dropdown.Trigger>
                  <Dropdown.Content className="dropdown min-w-52 text-gray-800">
                    <Dropdown.Item
                      className="dropdown-item flex items-center text-red"
                      onSelect={kick(m)}
                    >
                      <LeaveIcon className="mr-2 h-6 w-6" />
                      Kick
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="dropdown-item flex items-center text-red"
                      onSelect={ban(m)}
                    >
                      <LeaveIcon className="mr-2 h-6 w-6" />
                      Ban
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Root>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
