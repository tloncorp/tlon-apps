import cn from 'classnames';
import React, { PropsWithChildren, useCallback } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import X16Icon from '@/components/icons/X16Icon';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import { disableDefault, isTalk } from '@/logic/utils';
import ChatSearchResults from './ChatSearchResults';
import { ChatMap, useChatSearchInput } from './useChatSearchInput';

export type ChatSearchProps = PropsWithChildren<{
  whom: string;
  root: string;
  query?: string;
  scan: ChatMap;
  isLoading: boolean;
  placeholder: string;
}>;

export default function ChatSearch({
  whom,
  root,
  query,
  scan,
  isLoading,
  placeholder,
  children,
}: ChatSearchProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isSmall = useMedia('(min-width: 768px) and (max-width: 1099px)');
  const scrollerRef = React.useRef<VirtuosoHandle>(null);
  const { selected, rawInput, onChange, onKeyDown } = useChatSearchInput({
    root,
    query,
    scan,
    onNavigate: useCallback(({ index, time, setSelected }) => {
      const scroller = scrollerRef.current;
      if (!scroller) {
        return;
      }

      scroller.scrollIntoView({
        index,
        behavior: 'auto',
        done: () => {
          setSelected({ index, time });
        },
      });
    }, []),
  });

  const preventClose = useCallback((e: Event) => {
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
      <div className="max-w-[240px] flex-none">
        {!isMobile && !isSmall ? children : null}
      </div>
      <div className="relative flex-1">
        <label
          className="relative flex w-full items-center"
          onKeyDown={onKeyDown}
        >
          <span className="sr-only">Search</span>
          <span className="absolute left-0 pl-2">
            <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
          </span>
          <input
            id="search"
            type="text"
            role="combobox"
            aria-controls="search-results"
            aria-owns="search-results"
            aria-activedescendant={`search-result-${selected.time.toString()}`}
            aria-expanded={true}
            autoFocus
            className="input h-8 w-full bg-gray-50 pl-8 text-lg mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
            value={rawInput}
            onChange={onChange}
            placeholder={placeholder}
          />
          {isSmall ? (
            <Link
              className="absolute right-1 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
              to={`${root}/search`}
            >
              <X16Icon className="h-4 w-4 text-gray-400" />
            </Link>
          ) : null}
        </label>
        <Dialog.Root open modal={false} onOpenChange={onDialogClose}>
          <Dialog.Content
            onInteractOutside={preventClose}
            onOpenAutoFocus={disableDefault}
            className="absolute left-0 top-[40px] z-50 w-full outline-none"
          >
            <section
              tabIndex={0}
              role="listbox"
              aria-setsize={scan?.size || 0}
              id="search-results"
              className={cn(
                'default-focus dialog border-2 border-transparent shadow-lg dark:border-gray-50',
                query ? 'h-[60vh] min-h-[480px]' : 'h-[200px]'
              )}
            >
              <ChatSearchResults
                ref={scrollerRef}
                whom={whom}
                root={root}
                scan={scan}
                isLoading={isLoading}
                query={query}
                selected={selected.index}
              />
            </section>
          </Dialog.Content>
        </Dialog.Root>
      </div>
      {!isSmall && (
        <Link to={backTo} className="default-focus secondary-button">
          Cancel
        </Link>
      )}
    </div>
  );
}
