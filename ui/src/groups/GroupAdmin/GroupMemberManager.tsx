import React, {
  ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { debounce } from 'lodash';
import { deSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import { Link, useLocation } from 'react-router-dom';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import MemberScroller from './MemberScroller';

export default function GroupMemberManager() {
  const location = useLocation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
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
    <div className="flex h-full flex-col">
      <p className="mb-4 text-sm font-semibold text-gray-400">
        {members.length} total
      </p>
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
      <div className="grow">
        <MemberScroller members={results} />
      </div>
    </div>
  );
}
