import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import useDebounce from '@/logic/useDebounce';
import { useChannel, useRouteGroup } from '@/state/groups';
import React, { ChangeEvent, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';

interface RouteParams {
  chShip: string;
  chName: string;
  query: string;
  [key: string]: string;
}

export default function ChatSearch() {
  const navigate = useNavigate();
  const { chShip, chName, query } = useParams<RouteParams>();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const groupFlag = useRouteGroup();
  const channel = useChannel(groupFlag, nest);
  const [rawInput, setRawInput] = React.useState(query || '');
  const debouncedSearch = useDebounce((input: string) => {
    navigate(`/groups/${groupFlag}/channels/${nest}/search/${input}`);
  }, 500);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target as HTMLInputElement;
      const value = input.value.trim();
      setRawInput(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  return (
    <label className="relative ml-auto flex items-center">
      <span className="sr-only">Search</span>
      <span className="absolute inset-y-[5px] left-0 flex h-8 w-8 items-center pl-2 text-gray-400">
        <MagnifyingGlassIcon className="h-6 w-6" />
      </span>
      <input
        type="text"
        className="input h-10 w-[360px] bg-gray-50 pl-8 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
        value={rawInput}
        onChange={onChange}
        placeholder={channel ? `Search in ${channel.meta.title}` : 'Search'}
      />
    </label>
  );
}
