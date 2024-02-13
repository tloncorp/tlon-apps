import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import { useGroup, useRouteGroup } from '@/state/groups/groups';
import { daToUnix, deSig } from '@urbit/api';
import bigInt from 'big-integer';
import cn from 'classnames';
import fuzzy from 'fuzzy';
import { debounce } from 'lodash';
import React, {
  ChangeEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import PendingScroller from './PendingScroller';

// *@da == ~2000.1.1
const DA_BEGIN = daToUnix(bigInt('170141184492615420181573981275213004800'));

export default function GroupPendingManager() {
  const flag = useRouteGroup();
  const group = useGroup(flag, true);
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

  if (!group) {
    return null;
  }

  return (
    <div className={cn('flex h-1/2 flex-col')}>
      <div
        className={cn(
          'flex w-full flex-col items-center justify-between space-y-2 pb-2 md:flex-row'
        )}
      >
        <h2 className="flex w-full items-center text-lg font-semibold md:w-auto">
          Invited{' '}
          <div className="ml-2 rounded border border-gray-800 px-2 py-0.5 text-xs font-medium uppercase text-gray-800">
            {results.length}
          </div>
        </h2>

        <label className="relative ml-auto flex w-full items-center md:w-auto">
          <span className="sr-only">Filter Pending</span>
          <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
            <MagnifyingGlass16Icon className="h-4 w-4" />
          </span>
          <input
            className="input h-10 w-full bg-gray-50 pl-7 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base lg:w-[240px]"
            placeholder={`Filter Pending`}
            value={rawInput}
            onChange={onChange}
          />
        </label>
      </div>
      <div className={cn('grow')}>
        <PendingScroller members={results} />
      </div>
    </div>
  );
}
