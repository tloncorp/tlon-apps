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

interface NewGroupInviteProps {
  groupName: string;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  shipsToInvite: ShipWithRoles[];
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipWithRoles[]>>;
}

type Role = 'Member' | 'Moderator' | 'Admin';

interface ShipWithRoles {
  patp: string;
  roles: Role[];
}

const roles: Role[] = ['Member', 'Admin', 'Moderator'];

interface MemberRoleDropDownMenuProps {
  ship: ShipWithRoles;
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipWithRoles[]>>;
}

function MemberRoleDropDownMenu({
  ship,
  setShipsToInvite,
}: MemberRoleDropDownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <DropdownMenu.Root onOpenChange={(open) => setIsOpen(open)} open={isOpen}>
        <DropdownMenu.Trigger asChild className="appearance-none">
          <button
            className={cn(
              'default-focus flex items-center rounded-lg p-0.5 text-gray-600 transition-opacity focus-within:opacity-100 hover:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100'
            )}
            aria-label="Open Member Role Options"
          >
            {ship.roles.map((role, index) => {
              if (ship.roles.length === 1) {
                return <span key={`${role}+{${index}}`}>{role}</span>;
              }
              if (ship.roles.length === index + 1) {
                return <span key={`${role}+{${index}}`}>{role}</span>;
              }
              return <span key={`${role}+{${index}}`}>{role}, &nbsp; </span>;
            })}
            <CaretDownIcon className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="dropdown">
          {roles.map((role) => (
            <DropdownMenu.Item
              key={role}
              className="dropdown-item flex items-center space-x-2"
              onClick={() =>
                setShipsToInvite((prevState) => {
                  const currentRoles =
                    prevState.find((prevShip) => prevShip.patp === ship.patp)
                      ?.roles ?? [];
                  const currentIncludesThisRole =
                    currentRoles.find((currentRole) => currentRole === role) &&
                    role !== 'Member';

                  if (currentIncludesThisRole) {
                    return [
                      ...prevState.filter(
                        (prevShip) => prevShip.patp !== ship.patp
                      ),
                      {
                        patp: ship.patp,
                        roles: ship.roles.filter(
                          (prevRole) => prevRole !== role
                        ),
                      },
                    ];
                  }

                  return [
                    ...prevState.filter(
                      (prevShip) => prevShip.patp !== ship.patp
                    ),
                    {
                      patp: ship.patp,
                      roles: _.uniq([...currentRoles, role]),
                    },
                  ];
                })
              }
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
  return (
    <div className="flex h-[132px] flex-col space-y-2 overflow-auto rounded-lg border-2 border-gray-100 p-2">
      {_.sortBy(shipsToInvite, 'patp').map((ship: ShipWithRoles) => (
        <div
          className="flex w-full items-center justify-between"
          key={ship.patp}
        >
          <div className="flex items-center space-x-2">
            <IconButton
              icon={<XIcon className="h-4 w-4" />}
              label="Remove"
              action={() =>
                setShipsToInvite((prevState) =>
                  prevState.filter((prevShip) => prevShip.patp !== ship.patp)
                )
              }
            />
            <Avatar ship={ship.patp} size="xs" />
            <ShipName className="font-semibold" name={ship.patp} showAlias />
          </div>
          <MemberRoleDropDownMenu
            ship={ship}
            setShipsToInvite={setShipsToInvite}
          />
        </div>
      ))}
    </div>
  );
}

export default function NewGroupInvite({
  groupName,
  goToNextStep,
  goToPrevStep,
  shipsToInvite,
  setShipsToInvite,
}: NewGroupInviteProps) {
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);

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
          roles: ['Member' as Role],
        })),
    ]);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">Group Members</span>
        <span className="pt-1 font-bold text-gray-600">
          Invite members to <span className="text-black">{groupName}</span>
        </span>
      </div>
      <div className="flex flex-col space-y-2">
        <ShipSelector
          ships={shipSelectorShips}
          setShips={setShipSelectorShips}
          isMulti={false}
          onEnter={handleEnter}
        />
        <GroupMemberRoleList
          shipsToInvite={shipsToInvite}
          setShipsToInvite={setShipsToInvite}
        />
      </div>
      <div className="flex justify-between">
        <button className="font-semibold text-gray-600" onClick={goToNextStep}>
          Skip
        </button>
        <div className="flex justify-end space-x-2 py-4">
          <button className="secondary-button" onClick={goToPrevStep}>
            Back
          </button>
          <button
            disabled={shipsToInvite.length === 0}
            className="button"
            onClick={goToNextStep}
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
