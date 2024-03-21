import * as Dialog from '@radix-ui/react-dialog';
import { ChatMap } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';

import useActiveTab from '@/components/Sidebar/util';
import { useSafeAreaInsets } from '@/logic/native';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import { disableDefault } from '@/logic/utils';

import ChatSearchResults from './ChatSearchResults';
import SearchBar from './SearchBar';
import { useChatSearchInput } from './useChatSearchInput';

export type ChatSearchProps = PropsWithChildren<{
  whom: string;
  root: string;
  query?: string;
  scan: ChatMap;
  searchDetails?: {
    numResults: number;
    depth: number;
    oldestMessageSearched: Date | null;
    searchComplete: boolean;
  };
  isLoading: boolean;
  placeholder: string;
  endReached: () => void;
}>;

export default function ChatSearch({
  whom,
  root,
  query,
  scan,
  searchDetails,
  isLoading,
  placeholder,
  endReached,
  children,
}: ChatSearchProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isSmall = useMedia('(min-width: 768px) and (max-width: 1099px)');
  const activeTab = useActiveTab();
  const safeAreaInsets = useSafeAreaInsets();
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

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        navigate(root);
      }
    },
    [navigate, root]
  );

  // This is a hack to prevent the bug where nested @radix-ui components cause
  // pointerEvents to get set to none on body which trips up our prevent close
  // detection
  useEffect(() => {
    setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 0);
  });

  return (
    <div
      className="border-b-2 border-gray-50 bg-white"
      style={{ paddingTop: safeAreaInsets.top }}
    >
      <div
        className={cn(
          'flex w-full flex-1 items-center justify-between space-x-2',
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
            <SearchBar
              value={rawInput}
              setValue={onChange}
              placeholder={placeholder}
              isSmall={isSmall}
            />
          </label>
          <Dialog.Root open onOpenChange={onOpenChange}>
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
                  query ? 'flex h-[60vh] min-h-[480px] flex-col' : 'h-[200px]'
                )}
              >
                <ChatSearchResults
                  ref={scrollerRef}
                  whom={whom}
                  root={root}
                  scan={scan}
                  searchDetails={searchDetails}
                  isLoading={isLoading}
                  query={query}
                  selected={selected.index}
                  endReached={endReached}
                />
              </section>
            </Dialog.Content>
          </Dialog.Root>
        </div>
        {!isSmall && (
          <Link to={root} className="default-focus secondary-button">
            Cancel
          </Link>
        )}
      </div>
    </div>
  );
}
