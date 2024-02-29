import { ChatMap, Post, Reply } from '@tloncorp/shared/dist/urbit/channel';
import { Writ } from '@tloncorp/shared/dist/urbit/dms';
import { BigInteger } from 'big-integer';
import React, { useMemo } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import { makePrettyShortDate } from '@/logic/utils';

import ChatSearchResult from './ChatSearchResult';

interface ChatSearchResultsProps {
  whom: string;
  root: string;
  scan: ChatMap;
  searchDetails?: {
    numResults: number;
    depth: number;
    oldestMessageSearched: Date | null;
    searchComplete: boolean;
  };
  isLoading: boolean;
  query?: string;
  selected?: number;
  withHeader?: boolean;
  endReached: () => void;
}

interface ChatSearchResultEntry {
  whom: string;
  root: string;
  time: BigInteger;
  writ: Post | Writ | Reply;
  selected: boolean;
}

function itemContent(_i: number, entry: ChatSearchResultEntry) {
  return (
    <div className="pb-2 pr-2">
      <ChatSearchResult {...entry} index={_i} />
    </div>
  );
}

const ChatSearchResults = React.forwardRef<
  VirtuosoHandle,
  ChatSearchResultsProps
>(
  (
    {
      whom,
      root,
      scan,
      searchDetails,
      isLoading,
      selected,
      endReached,
      withHeader = true,
      query,
    },
    scrollerRef
  ) => {
    const isMobile = useIsMobile();
    const thresholds = {
      atBottomThreshold: 125,
      atTopThreshold: 125,
      overscan: isMobile
        ? { main: 200, reverse: 200 }
        : { main: 400, reverse: 400 },
    };

    const entries = useMemo(
      () =>
        scan
          ? scan
              .toArray()
              .filter(([_int, writ]) => writ !== null)
              .map(
                ([int, writ], i): ChatSearchResultEntry => ({
                  whom,
                  root,
                  time: int,
                  writ: writ as Post | Writ | Reply,
                  selected: i === selected,
                })
              )
          : [],
      [scan, whom, root, selected]
    );

    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {withHeader && (
          <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
            {query && (
              <strong>
                Search Results for &ldquo;
                <span className="text-gray-800">{query}</span>&rdquo;
              </strong>
            )}
            {entries.length > 0 && (
              <strong>
                Sorted by <span className="text-gray-800">Most Recent</span>
              </strong>
            )}
          </div>
        )}
        {entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="font-semibold text-gray-600">
              {query ? 'No results found' : 'Enter a search to get started'}
            </div>
            {query && searchDetails && (
              <SearchDetails
                searchDetails={searchDetails}
                loading={isLoading}
              />
            )}
          </div>
        ) : (
          <Virtuoso
            {...thresholds}
            tabIndex={-1}
            ref={scrollerRef}
            data={entries}
            itemContent={itemContent}
            computeItemKey={(i, item) => item.time.toString()}
            endReached={endReached}
            className="h-full w-full list-none overflow-x-hidden overflow-y-scroll"
            components={{
              Footer: () =>
                query && searchDetails ? (
                  <SearchDetails
                    searchDetails={searchDetails}
                    loading={isLoading}
                  />
                ) : (
                  <span />
                ),
            }}
          />
        )}
      </div>
    );
  }
);

export default ChatSearchResults;

function SearchDetails({
  searchDetails,
  loading,
}: {
  loading: boolean;
  searchDetails: {
    numResults: number;
    depth: number;
    oldestMessageSearched: Date | null;
    searchComplete: boolean;
  };
}) {
  return (
    <div className="mt-2 flex w-full items-center justify-center text-gray-400">
      {(loading || !searchDetails.searchComplete) && (
        <LoadingSpinner className="mr-2 h-3 w-3 text-black" />
      )}
      {searchDetails.numResults !== 0 && (
        <>
          <strong className="text-gray-800">{searchDetails.numResults}</strong>
          &nbsp;results found&nbsp;{'·'}&nbsp;
        </>
      )}
      {searchDetails.oldestMessageSearched ? (
        <span className="">
          Searched&nbsp;
          {searchDetails.searchComplete ? (
            'all channel history'
          ) : (
            <>
              through&nbsp;
              <span className="text-gray-800">
                {makePrettyShortDate(
                  new Date(searchDetails?.oldestMessageSearched)
                )}
              </span>
            </>
          )}
        </span>
      ) : (
        'Searching...'
      )}
    </div>
  );
}
