import Avatar from '@/components/Avatar';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import React, { useState } from 'react';

interface NewGroupInviteProps {
  groupName: string;
  goToPrevStep: () => void;
  goToNextStep: () => void;
  shipsToInvite: ShipOption[];
  setShipsToInvite: React.Dispatch<React.SetStateAction<ShipOption[]>>;
  shipsWithRoles: ShipWithRole[];
  setShipsWithRoles: React.Dispatch<React.SetStateAction<ShipWithRole[]>>;
}

interface ShipWithRole {
  patp: string;
  role: string;
}

interface GroupMemberRoleListProps {
  shipsToInvite: ShipOption[];
  shipsWithRoles: ShipWithRole[];
  setShipsWithRoles: (ships: ShipWithRole[]) => void;
}

function GroupMemberRoleList({
  shipsToInvite,
  shipsWithRoles,
  setShipsWithRoles,
}: GroupMemberRoleListProps) {
  return (
    <div className="flex h-[132px] flex-col space-y-2 overflow-auto rounded-lg border-2 border-gray-100 p-2">
      {shipsToInvite.map((ship: ShipOption) => (
        <div
          className="flex w-full items-center justify-between"
          key={ship.value}
        >
          <div className="flex items-center space-x-2">
            <Avatar ship={ship.value} size="xs" />
            <span className="font-semibold">{ship.value}</span>
          </div>
          <span>
            {shipsWithRoles.find(
              (shipWithRole) => shipWithRole.patp === ship.value
            )?.role
              ? shipsWithRoles.find(
                  (shipWithRole) => shipWithRole.patp === ship.value
                )?.role
              : 'Member'}
          </span>
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
  shipsWithRoles,
  setShipsWithRoles,
}: NewGroupInviteProps) {
  const [shipSelectorShips, setShipSelectorShips] = useState<ShipOption[]>([]);

  const handleEnter = (ships: ShipOption[]) => {
    setShipsToInvite((prevState) => [
      ...prevState,
      ...ships.filter(
        (ship) => !prevState.find((prevShip) => prevShip.value === ship.value)
      ),
    ]);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col">
        <span className="text-lg font-bold">Group Members</span>
        <span className="pt-1 font-bold text-gray-600">
          Invite members to {groupName}
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
          shipsWithRoles={shipsWithRoles}
          setShipsWithRoles={setShipsWithRoles}
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
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
