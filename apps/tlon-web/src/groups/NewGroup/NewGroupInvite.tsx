import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { PrivacyType } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import _ from 'lodash';
import React, { useCallback, useState } from 'react';

import ActionMenu, { Action } from '@/components/ActionMenu';
import Avatar from '@/components/Avatar';
import IconButton from '@/components/IconButton';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import CaretDownIcon from '@/components/icons/CaretDownIcon';
import X16Icon from '@/components/icons/X16Icon';
import XIcon from '@/components/icons/XIcon';
import { Status } from '@/logic/status';

interface NewGroupInviteProps {
  groupName: string;
  groupPrivacy: PrivacyType;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  shipsToInvite: ShipWithRoles[];
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipWithRoles[]>>;
  status: Status;
}

// defined again to avoid dependency cycle
type Role = 'Member' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

const roles: Role[] = ['Member', 'Admin'];

interface MemberRoleDropDownMenuProps {
  selectedRole: Role;
  setSelectedRole: React.Dispatch<React.SetStateAction<Role>>;
}

function MemberRoleDropDownMenu({
  selectedRole,
  setSelectedRole,
}: MemberRoleDropDownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions: Action[] = roles.map((role) => ({
    key: role,
    onClick: () => setSelectedRole(role),
    content: role,
  }));

  return (
    <ActionMenu open={isOpen} onOpenChange={setIsOpen} actions={actions}>
      <button
        className={cn(
          'default-focus text-md mx-2 flex items-center rounded-lg bg-gray-400 px-2 py-0.5 font-bold text-black mix-blend-multiply transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 dark:mix-blend-screen'
        )}
        aria-label="Open Member Role Options"
      >
        <span>{selectedRole}</span>
        <CaretDownIcon className="h-4 w-4" />
      </button>
    </ActionMenu>
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
  const [selectedRole, setSelectedRole] = useState<Role>('Member');
  const submitText =
    shipsToInvite.length > 0 ? 'Invite People & Create Group' : 'Create Group';
  const ready = status === 'idle';

  const handleEnter = useCallback(
    (ships: ShipOption[]) => {
      setShipsToInvite((prevState) => [
        ...prevState,
        ...ships
          .filter(
            (ship) =>
              !prevState.find((prevShip) => prevShip.patp === ship.value)
          )
          .map((ship) => ({
            patp: ship.value,
            alias: ship.label,
            roles: [selectedRole],
          })),
      ]);
    },
    [selectedRole, setShipsToInvite]
  );

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
          isMulti={true}
          ships={[]}
          setShips={handleEnter}
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
