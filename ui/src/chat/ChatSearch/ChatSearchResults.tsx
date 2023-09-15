import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BigInteger } from 'big-integer';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { useIsMobile } from '@/logic/useMedia';
import { useChatState } from '@/state/chat';
import { Note } from '@/types/channel';
import ChatScrollerPlaceholder from '../ChatScroller/ChatScrollerPlaceholder';
import ChatSearchResult from './ChatSearchResult';

interface ChatSearchResultsProps {
  whom: string;
  root: string;
  scan: BTree<BigInteger, Note> | null;
  isLoading: boolean;
  query?: string;
  selected?: number;
}

interface ChatSearchResultEntry {
  whom: string;
  root: string;
  time: BigInteger;
  writ: Note;
  selected: boolean;
  msgLoad: (time: BigInteger, type: 'click' | 'hover') => void;
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
>(({ whom, root, scan, isLoading, selected, query }, scrollerRef) => {
  const [delayedLoading, setDelayedLoading] = useState(false);
  const reallyLoading = isLoading && query && query !== '';
  const isMobile = useIsMobile();
  const thresholds = {
    atBottomThreshold: 125,
    atTopThreshold: 125,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const loadMsgs = useMemo(() => {
    return debounce(
      (time: BigInteger) => {
        useChatState.getState().fetchMessagesAround(whom, '25', time);
      },
      200,
      { trailing: true }
    );
  }, [whom]);

  const msgLoad = useCallback(
    (time: BigInteger, type: 'click' | 'hover') => {
      loadMsgs(time);

      if (type === 'click') {
        loadMsgs.flush();
      }
    },
    [loadMsgs]
  );

  const entries = useMemo(() => {
    return scan
      ? scan.toArray().map(
          ([int, writ], i): ChatSearchResultEntry => ({
            whom,
            root,
            time: int,
            writ,
            selected: i === selected,
            msgLoad,
          })
        )
      : [];
  }, [scan, whom, root, selected, msgLoad]);

  useEffect(() => {
    let timeout = 0;

    if (reallyLoading) {
      timeout = setTimeout(() => {
        setDelayedLoading(true);
      }, 150) as unknown as number;
    } else {
      clearTimeout(timeout);
      setDelayedLoading(false);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [reallyLoading]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="mb-6 flex items-center justify-between text-sm text-gray-400">
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
      {delayedLoading ? (
        <div className="-mx-4 flex-1">
          <ChatScrollerPlaceholder count={30} />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center">
          <div className="font-semibold text-gray-600">
            {query ? 'No results found' : 'Enter a search to get started'}
          </div>
        </div>
      ) : (
        <Virtuoso
          {...thresholds}
          tabIndex={-1}
          ref={scrollerRef}
          data={entries}
          itemContent={itemContent}
          computeItemKey={(i, item) => item.time.toString()}
          className="h-full w-full list-none overflow-x-hidden overflow-y-scroll"
        />
      )}
    </div>
  );
});

export default ChatSearchResults;
