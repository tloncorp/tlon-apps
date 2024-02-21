import { MouseEvent, useCallback, useState } from 'react';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import CheckIcon from '@/components/icons/CheckIcon';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { getSectTitle } from '@/logic/utils';
import {
  useGroup,
  useGroupFlag,
  useGroupSectMutation,
  useVessel,
} from '@/state/groups';
import { Vessel } from '@/types/groups';

export default function RoleSelect({
  role,
  member,
}: {
  role: string;
  member: string;
}) {
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const vessel = useVessel(flag, member);
  const [sectLoading, setSectLoading] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const { mutateAsync: sectMutation } = useGroupSectMutation();

  const toggleSect = useCallback(
    (ship: string, sect: string, v: Vessel) => async (event: MouseEvent) => {
      event.preventDefault();

      const inSect = v.sects.includes(sect);

      if (inSect && sect === 'admin' && flag.includes(ship)) {
        setIsOwner(true);
        return;
      }
      if (inSect) {
        try {
          setSectLoading(sect);
          await sectMutation({ flag, ship, sects: [sect], operation: 'del' });
          setSectLoading('');
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          setSectLoading(sect);
          await sectMutation({ flag, ship, sects: [sect], operation: 'add' });
          setSectLoading('');
        } catch (e) {
          console.log(e);
        }
      }
    },
    [flag, sectMutation]
  );

  if (!group) {
    return null;
  }

  return (
    <button
      onClick={toggleSect(member, role, vessel)}
      className="flex items-center"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
        {sectLoading === role ? (
          <LoadingSpinner className="h-4 w-4" />
        ) : isOwner ? (
          <ExclamationPoint className="h-4 w-4 text-red" />
        ) : vessel.sects.includes(role) ? (
          <CheckIcon className="h-4 w-4" />
        ) : null}
      </div>
      <span className="ml-4">{getSectTitle(group.cabals, role)}</span>
    </button>
  );
}
