import { debounce } from 'lodash';
import cn from 'classnames';
import { daToUnix, deSig } from '@urbit/api';
import React, {
  ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import fuzzy from 'fuzzy';
import { Link, useLocation } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import { useContacts } from '@/state/contact';
import {
  useAmAdmin,
  useGroup,
  useGroupState,
  useRouteGroup,
} from '@/state/groups/groups';
import ElipsisCircleIcon from '@/components/icons/EllipsisCircleIcon';
import ElipsisIcon from '@/components/icons/EllipsisIcon';
import LeaveIcon from '@/components/icons/LeaveIcon';
import CheckIcon from '@/components/icons/CheckIcon';
import CaretDown16Icon from '@/components/icons/CaretDown16Icon';
import { getSectTitle, toTitleCase } from '@/logic/utils';
import { Vessel } from '@/types/groups';
import bigInt from 'big-integer';

// *@da == ~2000.1.1
const DA_BEGIN = daToUnix(bigInt('170141184492615420181573981275213004800'));

export default function GroupPendingManager() {
  const location = useLocation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isAdmin = useAmAdmin(flag);
  const contacts = useContacts();
  const modalNavigate = useModalNavigate();
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const pending = useMemo(() => {
    let members: string[] = [];

    if (!group) {
      return members;
    }

    members = members.concat(
      Object.entries(group.fleet)
        .filter(([k, v]) => v.joined === DA_BEGIN && !flag.includes(k))
        .map(([k]) => k)
    );

    if ('shut' in group.cordon) {
      members = group.cordon.shut.ask.concat(group.cordon.shut.pending);
    }

    return members;
  }, [group, flag]);

  const results = useMemo(
    () =>
      fuzzy
        .filter(search, pending)
        .sort((a, b) => {
          const filter = deSig(search) || '';
          const left = deSig(a.string)?.startsWith(filter)
            ? a.score + 1
            : a.score;
          const right = deSig(b.string)?.startsWith(filter)
            ? b.score + 1
            : b.score;

          return right - left;
        })
        .map((result) => pending[result.index]),
    [search, pending]
  );

  const onUpdate = useRef(
    debounce((value: string) => {
      setSearch(value);
    }, 150)
  );

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setRawInput(value);
    onUpdate.current(value);
  }, []);

  const reject = useCallback(
    (ship: string, kind: 'ask' | 'pending') => () => {
      useGroupState.getState().revoke(flag, [ship], kind);
    },
    [flag]
  );

  const approve = useCallback(
    (ship: string) => () => {
      useGroupState.getState().invite(flag, [ship]);
    },
    [flag]
  );

  const onViewProfile = (ship: string) => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  if (!group) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center">
        <input
          value={rawInput}
          onChange={onChange}
          className="input flex-1 font-semibold"
          placeholder="Search Members"
          aria-label="Search Members"
        />
        <Link
          to={`/groups/${flag}/invite`}
          state={{ backgroundLocation: location }}
          className="button ml-2 bg-blue dark:text-black"
        >
          Invite
        </Link>
      </div>
      <ul className="space-y-6 py-2">
        {results.map((m) => {
          const inAsk =
            'shut' in group.cordon && group.cordon.shut.ask.includes(m);
          const inPending =
            'shut' in group.cordon && group.cordon.shut.pending.includes(m);

          return (
            <li key={m} className="flex items-center font-semibold">
              <div className="cursor-pointer" onClick={() => onViewProfile(m)}>
                <Avatar ship={m} size="small" className="mr-2" />
              </div>
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
              {isAdmin ? (
                <div className="ml-auto flex items-center space-x-3">
                  {inAsk || inPending ? (
                    <button
                      className="secondary-button min-w-20"
                      onClick={reject(m, inAsk ? 'ask' : 'pending')}
                    >
                      {inAsk ? 'Reject' : 'Cancel'}
                    </button>
                  ) : null}
                  <button
                    disabled={!inAsk}
                    className="button min-w-24 bg-blue text-white disabled:bg-gray-100 disabled:text-gray-600 dark:text-black dark:disabled:text-gray-600"
                    onClick={approve(m)}
                  >
                    {inAsk ? 'Approve' : 'Invited'}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
