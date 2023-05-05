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
import InviteIcon16 from '@/components/icons/InviteIcon16';
import { useIsMobile } from '@/logic/useMedia';
import MemberScroller from './MemberScroller';

export default function GroupMemberManager() {
  const location = useLocation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const amAdmin = useAmAdmin(flag);
  const isMobile = useIsMobile();
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
    <div className={cn('card flex h-1/2 flex-col')}>
      <div className={cn('flex w-full items-center justify-between pb-2')}>
        <h2 className="flex items-center text-lg font-bold">
          Members{' '}
          <div className="ml-2 rounded border border-gray-800 px-2 py-0.5 text-xs font-medium uppercase text-gray-800">
            {members.length} joined
          </div>
        </h2>
        <label className="relative ml-auto flex items-center">
          <span className="sr-only">Filter Members</span>
          <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
            <MagnifyingGlass16Icon className="h-4 w-4" />
          </span>
          <input
            className="input h-10 w-[240px] bg-gray-50 pl-7 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
            placeholder={`Filter Members`}
            value={rawInput}
            onChange={onChange}
          />
        </label>
      </div>
      <div className={cn('grow')}>
        <MemberScroller members={results} />
      </div>
    </div>
  );
}
