import React, { useCallback } from 'react';
import { useGroup, useGroupState } from '@/state/groups';
import { useLocation, useNavigate } from 'react-router';
import { getGroupPrivacy } from '@/logic/utils';
import { Gang, Gangs } from '@/types/groups';
import GroupSummary from './GroupSummary';

interface GroupJoinItemProps {
  flag: string;
  gang: Gang;
}

function GroupJoinItem({ flag, gang }: GroupJoinItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const group = useGroup(flag);
  const privacy = gang.preview?.cordon
    ? getGroupPrivacy(gang.preview?.cordon)
    : 'public';

  const open = useCallback(() => {
    if (group) {
      return navigate(`/groups/${flag}`);
    }

    return navigate(`/gangs/${flag}`, {
      state: { backgroundLocation: location },
    });
  }, [flag, group, location, navigate]);

  const join = useCallback(async () => {
    await useGroupState.getState().join(flag, true);
    navigate(`/groups/${flag}`);
  }, [flag, navigate]);

  const reject = useCallback(async () => {
    /**
     * No need to confirm if the group is public, since it's easy to re-initiate
     * a join request
     */
    if (privacy === 'public') {
      await useGroupState.getState().reject(flag);
      return;
    }

    navigate(`/gangs/${flag}/reject`, {
      state: { backgroundLocation: location },
    });
  }, [flag, location, navigate, privacy]);

  return (
    <li className="relative flex items-center">
      <button
        className="flex w-full items-center justify-start rounded-xl p-2 text-left hover:bg-gray-50"
        onClick={open}
      >
        <GroupSummary flag={flag} {...gang.preview} size={'small'} />
      </button>
      <div className="absolute right-2 flex flex-row">
        {gang.invite ? (
          <button
            className="button bg-red-soft text-red mix-blend-multiply dark:mix-blend-screen"
            onClick={reject}
          >
            Reject
          </button>
        ) : null}
        <button
          className="button ml-2 bg-blue-soft text-blue mix-blend-multiply dark:mix-blend-screen"
          onClick={group ? open : join}
        >
          {group ? 'Open' : 'Join'}
        </button>
      </div>
    </li>
  );
}

interface GroupJoinListProps {
  gangs: Gangs;
}

export default function GroupJoinList({ gangs }: GroupJoinListProps) {
  const gangEntries = Object.entries(gangs);

  return (
    <ul>
      {gangEntries.map(([flag, gang]) => (
        <GroupJoinItem key={flag} flag={flag} gang={gang} />
      ))}
    </ul>
  );
}
