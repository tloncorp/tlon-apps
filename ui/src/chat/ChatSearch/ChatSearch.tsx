import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import X16Icon from '@/components/icons/X16Icon';
import useDebounce from '@/logic/useDebounce';
import { useChannel, useRouteGroup } from '@/state/groups';
import React, { ChangeEvent, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';

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
  const root = `/groups/${groupFlag}/channels/${nest}`;
  const debouncedSearch = useDebounce((input: string) => {
    if (!input) {
      navigate(root);
      return;
    }

    navigate(`${root}/search/${input}`);
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
      <span className="absolute left-0 pl-2">
        <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
      </span>
      <input
        type="text"
        className="input h-8 w-full bg-gray-50 pl-8 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal sm:w-[360px] md:text-base"
        value={rawInput}
        onChange={onChange}
        placeholder={channel ? `Search in ${channel.meta.title}` : 'Search'}
      />
      {rawInput ? (
        <Link
          className="absolute right-0 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
          to={`${root}/search`}
        >
          <X16Icon className="h-4 w-4 text-gray-400" />
        </Link>
      ) : null}
    </label>
  );
}
