import React, {
  ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import cn from 'classnames';
import { debounce } from 'lodash';
import { deSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import { Link, useLocation } from 'react-router-dom';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import { useAmAdmin } from '@/state/groups';
import { getPrivacyFromGroup } from '@/logic/utils';
import MemberScroller from './MemberScroller';

export default function GroupMemberManager() {
  const location = useLocation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const amAdmin = useAmAdmin(flag);
  const privacy = group ? getPrivacyFromGroup(group) : 'public';
  const members = useMemo(() => {
    if (!group) {
      return [];
    }
    return Object.keys(group.fleet).filter((k) => {
      if ('shut' in group.cordon) {
        return (
          !group.cordon.shut.ask.includes(k) &&
          !group.cordon.shut.pending.includes(k)
        );
      }
      return true;
    });
  }, [group]);

  const results = useMemo(
    () =>
      fuzzy
        .filter(search, members)
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
        .map((result) => members[result.index]),
    [search, members]
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

  if (!group) {
    return null;
  }

  return (
    <div className={cn(!amAdmin && 'card', 'flex h-full grow flex-col')}>
      <div
        className={cn(
          (privacy === 'public' || amAdmin) && 'mt-2',
          'mb-4 flex w-full items-center justify-between'
        )}
      >
        {(privacy === 'public' || amAdmin) && (
          <Link
            to={`/groups/${flag}/invite`}
            state={{ backgroundLocation: location }}
            className="button bg-blue dark:text-black"
          >
            Invite
          </Link>
        )}

        <label className="relative ml-auto flex items-center">
          <span className="sr-only">Search Prefences</span>
          <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
            <MagnifyingGlass16Icon className="h-4 w-4" />
          </span>
          <input
            className="input h-10 w-[260px] bg-gray-50 pl-7 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
            placeholder={`Filter Members (${members.length} total)`}
            value={rawInput}
            onChange={onChange}
          />
        </label>
      </div>
      <div className="grow">
        <MemberScroller members={results} />
      </div>
    </div>
  );
}
