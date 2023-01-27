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
import bigInt from 'big-integer';
import useRequestState from '@/logic/useRequestState';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';

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
  const { isPending, setPending, setReady, isFailed, setFailed } =
    useRequestState();
  const {
    isPending: isRevokePending,
    setPending: setRevokePending,
    setReady: setRevokeReady,
    isFailed: isRevokeFailed,
    setFailed: setRevokeFailed,
  } = useRequestState();
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
    (ship: string, kind: 'ask' | 'pending') => async () => {
      setRevokePending();
      try {
        await useGroupState.getState().revoke(flag, [ship], kind);
        setRevokeReady();
      } catch (e) {
        console.error('Error revoking invite, poke failed');
        setRevokeFailed();
        setTimeout(() => {
          setRevokeReady();
        }, 3000);
      }
    },
    [flag, setRevokePending, setRevokeReady, setRevokeFailed]
  );

  const approve = useCallback(
    (ship: string) => async () => {
      setPending();
      try {
        await useGroupState.getState().invite(flag, [ship]);
        setReady();
      } catch (e) {
        console.error('Error approving invite, poke failed');
        setFailed();
        setTimeout(() => {
          setReady();
        }, 3000);
      }
    },
    [flag, setPending, setReady, setFailed]
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
                      className={cn('secondary-button min-w-20', {
                        'bg-red': isRevokeFailed,
                        'text-white': isRevokeFailed,
                      })}
                      onClick={reject(m, inAsk ? 'ask' : 'pending')}
                      disabled={isRevokePending || isRevokeFailed}
                    >
                      {inAsk ? 'Reject' : 'Cancel'}
                      {isRevokePending ? (
                        <LoadingSpinner className="ml-2 h-4 w-4" />
                      ) : null}
                      {isRevokeFailed ? (
                        <ExclamationPoint className="ml-2 h-4 w-4" />
                      ) : null}
                    </button>
                  ) : null}
                  <button
                    disabled={!inAsk || isPending || isFailed}
                    className={cn(
                      'button min-w-24 text-white disabled:bg-gray-100 disabled:text-gray-600 dark:text-black dark:disabled:text-gray-600',
                      {
                        'bg-red': isFailed,
                        'bg-blue': !isFailed,
                      }
                    )}
                    onClick={approve(m)}
                  >
                    {inAsk ? 'Approve' : 'Invited'}
                    {isPending ? (
                      <LoadingSpinner className="ml-2 h-4 w-4" />
                    ) : null}
                    {isFailed ? (
                      <ExclamationPoint className="ml-2 h-4 w-4" />
                    ) : null}
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
