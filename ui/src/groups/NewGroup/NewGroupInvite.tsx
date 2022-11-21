import React, { useState } from 'react';
import _ from 'lodash';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import cn from 'classnames';
import Avatar from '@/components/Avatar';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import ShipName from '@/components/ShipName';
import CaretDownIcon from '@/components/icons/CaretDownIcon';
import IconButton from '@/components/IconButton';
import XIcon from '@/components/icons/XIcon';
import { PrivacyType } from '@/types/groups';
import { Status } from '@/logic/status';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import X16Icon from '@/components/icons/X16Icon';

interface NewGroupInviteProps {
  groupName: string;
  groupPrivacy: PrivacyType;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  shipsToInvite: ShipWithRoles[];
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipWithRoles[]>>;
  status: Status;
}

type Role = 'Member' | 'Moderator' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

const roles: Role[] = ['Member', 'Admin', 'Moderator'];

interface MemberRoleDropDownMenuProps {
  selectedRole: Role;
  setSelectedRole: React.Dispatch<React.SetStateAction<Role>>;
}

function MemberRoleDropDownMenu({
  selectedRole,
  setSelectedRole,
}: MemberRoleDropDownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <DropdownMenu.Root onOpenChange={(open) => setIsOpen(open)} open={isOpen}>
        <DropdownMenu.Trigger asChild className="appearance-none">
          <button
            className={cn(
              'default-focus text-md mx-2 flex items-center rounded-lg bg-gray-400 py-0.5 px-2 font-bold text-black mix-blend-multiply transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 dark:mix-blend-screen'
            )}
            aria-label="Open Member Role Options"
          >
            <span>{selectedRole}</span>
            <CaretDownIcon className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          {roles.map((role) => (
            <DropdownMenu.Item
              key={role}
              className="dropdown-item flex items-center space-x-2"
              onClick={() => setSelectedRole(role)}
            >
              {role}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}

interface GroupMemberRoleListProps {
  shipsToInvite: ShipWithRoles[];
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipWithRoles[]>>;
}

function GroupMemberRoleList({
  shipsToInvite,
  setShipsToInvite,
}: GroupMemberRoleListProps) {
  const sortedMemberList = shipsToInvite.reduce<{
    [role: string]: ShipWithRoles[];
  }>((memo, x) => {
    if (!memo[x.roles[0].toString()]) {
      // eslint-disable-next-line no-param-reassign
      memo[x.roles[0].toString()] = [];
    }
    memo[x.roles[0].toString()].push(x);
    return memo;
  }, {});

  return (
    <div className="flex h-32 flex-col space-y-6 overflow-auto rounded-lg p-2">
      {Object.keys(sortedMemberList).map((role: string) => (
        <div className="w-full">
          <div className="mb-2 text-gray-400">
            Inviting {sortedMemberList[role].length} people as "{role}"
          </div>
          <div className="flex flex-wrap space-x-2">
            {sortedMemberList[role].map((ship: ShipWithRoles) => (
              <span
                className="flex items-center space-x-1 rounded-lg bg-white p-1 pr-2"
                key={ship.patp}
              >
                <IconButton
                  className="p-0"
                  icon={<XIcon className="h-4 w-4 fill-gray-400" />}
                  small
                  label="Remove"
                  action={() =>
                    setShipsToInvite((prevState) =>
                      prevState.filter(
                        (prevShip) => prevShip.patp !== ship.patp
                      )
                    )
                  }
                />
                <Avatar ship={ship.patp} size="xs" />
                <ShipName
                  className="font-semibold"
                  name={ship.patp}
                  showAlias
                />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NewGroupInvite({
  groupName,
  goToNextStep,
  goToPrevStep,
  groupPrivacy,
  shipsToInvite,
  setShipsToInvite,
  status,
}: NewGroupInviteProps) {
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>('Member');
  const submitText =
    shipsToInvite.length > 0 ? 'Invite People & Create Group' : 'Create Group';
  const ready = status === 'initial';

  const handleEnter = (ships: ShipOption[]) => {
    setShipsToInvite((prevState) => [
      ...prevState,
      ...ships
        .filter(
          (ship) => !prevState.find((prevShip) => prevShip.patp === ship.value)
        )
        .map((ship) => ({
          patp: ship.value,
          alias: ship.label,
          roles: [selectedRole],
        })),
    ]);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">
          New {_.capitalize(groupPrivacy)} Group: Invite People
        </span>
        <span className="pt-1 text-gray-600">
          Invite members to <span className="text-black">{groupName}</span>
        </span>
      </div>
      <div className="input flex flex-col space-y-2">
        <ShipSelector
          inner
          placeholder={`Search for people or paste a list/.csv to invite as “${selectedRole}”`}
          ships={shipSelectorShips}
          setShips={setShipSelectorShips}
          isMulti={true}
          onEnter={handleEnter}
        />
        <MemberRoleDropDownMenu
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
        />
        <GroupMemberRoleList
          shipsToInvite={shipsToInvite}
          setShipsToInvite={setShipsToInvite}
        />
      </div>
      <div className="flex justify-end space-x-2 py-4">
        <button className="secondary-button" onClick={goToPrevStep}>
          Back
        </button>
        <button className="button" onClick={goToNextStep} disabled={!ready}>
          {ready ? (
            submitText
          ) : status === 'loading' ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" />
              <span>Creating</span>
            </>
          ) : status === 'error' ? (
            <>
              <X16Icon className="mr-2 h-4 w-4" />
              <span>Errored</span>
            </>
          ) : null}
        </button>
      </div>
    </div>
  );
}
