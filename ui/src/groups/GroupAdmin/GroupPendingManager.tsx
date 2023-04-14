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
  useGroupInviteMutation,
  useGroupRevokeMutation,
  useRouteGroup,
} from '@/state/groups/groups';
import bigInt from 'big-integer';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import { getPrivacyFromGroup } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';
import InviteIcon16 from '@/components/icons/InviteIcon16';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';

// *@da == ~2000.1.1
const DA_BEGIN = daToUnix(bigInt('170141184492615420181573981275213004800'));

export default function GroupPendingManager() {
  const location = useLocation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();
  const isAdmin = useAmAdmin(flag);
  const contacts = useContacts();
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const modalNavigate = useModalNavigate();
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const {
    mutate: revokeMutation,
    status: revokeStatus,
    reset: resetRevoke,
  } = useGroupRevokeMutation();
  const {
    mutate: inviteMutation,
    status: inviteStatus,
    reset: resetInvite,
  } = useGroupInviteMutation();

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
      try {
        revokeMutation({ flag, ships: [ship], kind });
      } catch (e) {
        console.error('Error revoking invite, poke failed');
        setTimeout(() => {
          resetRevoke();
        }, 3000);
      }
    },
    [flag, revokeMutation, resetRevoke]
  );

  const approve = useCallback(
    (ship: string) => async () => {
      try {
        inviteMutation({ flag, ships: [ship] });
      } catch (e) {
        console.error('Error approving invite, poke failed');
        setTimeout(() => {
          resetInvite();
        }, 3000);
      }
    },
    [flag, inviteMutation, resetInvite]
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
      <div
        className={cn(
          (privacy === 'public' || isAdmin) && 'mt-2',
          'mb-4 flex w-full items-center justify-between'
        )}
      >
        {(privacy === 'public' || isAdmin) && (
          <Link
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
            className="button bg-blue px-2 dark:text-black sm:px-4"
          >
            {isMobile ? <InviteIcon16 className="h-5 w-5" /> : 'Invite'}
          </Link>
        )}

        <label className="relative ml-auto flex items-center">
          <span className="sr-only">Search Prefences</span>
          <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
            <MagnifyingGlass16Icon className="h-4 w-4" />
          </span>
          <input
            className="input h-10 w-[240px] bg-gray-50 pl-7 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
            placeholder={`Filter Members (${pending.length} pending)`}
            value={rawInput}
            onChange={onChange}
          />
        </label>
      </div>
      <ul className="space-y-6 py-2">
        {results.map((m) => {
          const inAsk =
            'shut' in group.cordon && group.cordon.shut.ask.includes(m);
          const inPending =
            'shut' in group.cordon && group.cordon.shut.pending.includes(m);
          const contact = contacts[m];

          return (
            <li key={m} className="flex items-center font-semibold">
              <div className="cursor-pointer" onClick={() => onViewProfile(m)}>
                <Avatar ship={m} size="small" className="mr-2" />
              </div>
              <div className="flex flex-1 flex-col">
                <h2>{contact ? contact.nickname : <ShipName name={m} />}</h2>
                {contact?.nickname ? (
                  <p className="text-sm text-gray-400">{m}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="ml-auto flex items-center space-x-3">
                  {inAsk || inPending ? (
                    <button
                      className={cn('secondary-button min-w-20', {
                        'bg-red text-white': revokeStatus === 'error',
                      })}
                      onClick={reject(m, inAsk ? 'ask' : 'pending')}
                      disabled={
                        revokeStatus === 'loading' || revokeStatus === 'error'
                      }
                    >
                      {inAsk ? 'Reject' : 'Cancel'}
                      {revokeStatus === 'loading' ? (
                        <LoadingSpinner className="ml-2 h-4 w-4" />
                      ) : null}
                      {revokeStatus === 'error' ? (
                        <ExclamationPoint className="ml-2 h-4 w-4" />
                      ) : null}
                    </button>
                  ) : null}
                  <button
                    disabled={
                      !inAsk ||
                      inviteStatus === 'loading' ||
                      inviteStatus === 'error'
                    }
                    className={cn(
                      'small-button text-white disabled:bg-gray-100 disabled:text-gray-600 dark:text-black dark:disabled:text-gray-600',
                      {
                        'bg-red': inviteStatus === 'error',
                        'bg-blue': inviteStatus !== 'error',
                      }
                    )}
                    onClick={approve(m)}
                  >
                    {inAsk ? 'Approve' : 'Invited'}
                    {inviteStatus === 'loading' ? (
                      <LoadingSpinner className="ml-2 h-4 w-4" />
                    ) : null}
                    {inviteStatus === 'error' ? (
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
