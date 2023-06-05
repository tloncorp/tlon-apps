import cn from 'classnames';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import X16Icon from '@/components/icons/X16Icon';
import useDebounce from '@/logic/useDebounce';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import { isTalk } from '@/logic/utils';
import { useChannel, useRouteGroup } from '@/state/groups';
import React, { ChangeEvent, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import ChannelTitleButton from '@/channels/ChannelTitleButton';
import { disableDefault } from '@/logic/utils';
import ChatSearchResults from './ChatSearchResults';

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
  const isSmall = useMedia('(min-width: 768px) and (max-width: 1099px)');
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

  const preventClose = useCallback((e) => {
    const target = e.target as HTMLElement;
    const hasNavAncestor = target.id === 'search' || target.closest('#search');

    if (hasNavAncestor) {
      e.preventDefault();
    }
  }, []);

  const onDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        navigate(root);
      }
    },
    [navigate, root]
  );

  const backTo = isMobile && isTalk ? '/' : root;

  return (
    <div
      className={cn(
        'flex w-full flex-1 items-center justify-between space-x-2 border-b-2 border-gray-50 bg-white p-2',
        isSmall || isMobile ? 'p-3' : 'p-2'
      )}
    >
      {!isMobile && !isSmall ? (
        <ChannelTitleButton flag={groupFlag} nest={nest} />
      ) : null}
      <label className="relative flex flex-1 items-center">
        <span className="sr-only">Search</span>
        <span className="absolute left-0 pl-2">
          <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
        </span>
        <input
          id="search"
          type="text"
          autoFocus
          className="input h-8 w-full bg-gray-50 pl-8 text-lg mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
          value={rawInput}
          onChange={onChange}
          placeholder={channel ? `Search in ${channel.meta.title}` : 'Search'}
        />
        {isSmall ? (
          <Link
            className="absolute right-1 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
            to={`${root}/search`}
          >
            <X16Icon className="h-4 w-4 text-gray-400" />
          </Link>
        ) : null}
        <Dialog.Root open modal={false} onOpenChange={onDialogClose}>
          <Dialog.Content
            onInteractOutside={preventClose}
            onOpenAutoFocus={disableDefault}
            className="absolute left-0 top-[40px] z-50 w-full outline-none"
            role="combobox"
            aria-controls="leap-items"
            aria-owns="leap-items"
            aria-expanded={true}
          >
            <section
              className={cn(
                'dialog border-2 border-transparent shadow-lg dark:border-gray-50',
                query ? 'h-[60vh] min-h-[480px]' : 'h-[200px]'
              )}
            >
              <ChatSearchResults whom={chFlag} query={query} />
            </section>
          </Dialog.Content>
        </Dialog.Root>
      </label>
      {!isSmall && (
        <Link to={backTo} className="default-focus secondary-button">
          Cancel
        </Link>
      )}
    </div>
  );
}
