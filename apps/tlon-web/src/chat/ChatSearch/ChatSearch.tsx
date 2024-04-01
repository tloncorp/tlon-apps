import { ChatMap } from '@tloncorp/shared/dist/urbit/channel';
import cn from 'classnames';
import React, { PropsWithChildren, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import { VirtuosoHandle } from 'react-virtuoso';
import { useOnClickOutside } from 'usehooks-ts';

import { useSafeAreaInsets } from '@/logic/native';
import useMedia, { useIsMobile } from '@/logic/useMedia';

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
  const safeAreaInsets = useSafeAreaInsets();
  const containerRef = useRef<HTMLDivElement>(null);
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

  useOnClickOutside(containerRef, () => navigate(root));

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
        ref={containerRef}
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
          <div className="absolute left-0 top-[40px] z-50 w-full outline-none">
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
          </div>
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
