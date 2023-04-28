import CaretLeft16Icon from '@/components/icons/CaretLeft16Icon';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import X16Icon from '@/components/icons/X16Icon';
import useDebounce from '@/logic/useDebounce';
import { useIsMobile } from '@/logic/useMedia';
import { isTalk } from '@/logic/utils';
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
  const isMobile = useIsMobile();
  const [rawInput, setRawInput] = React.useState(query || '');
  const root = `/groups/${groupFlag}/channels/${nest}`;
  const debouncedSearch = useDebounce((input: string) => {
    if (!input) {
      navigate(`${root}/search`);
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

  const backTo = isMobile && isTalk ? '/' : root;

  return (
    <div className="flex w-full items-center justify-between border-b-2 border-gray-50 bg-white px-6 py-4 sm:px-4">
      <Link
        to={backTo}
        className="default-focus ellipsis inline-flex flex-none appearance-none items-center pr-2 text-gray-800"
        aria-label="Open Channels Menu"
      >
        <CaretLeft16Icon className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
      </Link>
      <label className="relative flex flex-1 items-center">
        <span className="sr-only">Search</span>
        <span className="absolute left-0 pl-2">
          <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
        </span>
        <input
          type="text"
          autoFocus
          className="input h-8 w-full bg-gray-50 pl-8 text-lg mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
          value={rawInput}
          onChange={onChange}
          placeholder={channel ? `Search in ${channel.meta.title}` : 'Search'}
        />
        {rawInput ? (
          <Link
            className="absolute right-1 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
            to={`${root}/search`}
          >
            <X16Icon className="h-4 w-4 text-gray-400" />
          </Link>
        ) : null}
      </label>
    </div>
  );
}
