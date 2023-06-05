import { debounce } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BigInteger } from 'big-integer';
import { useParams } from 'react-router';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useChatStore } from '@/chat/useChatStore';
import { ChatWrit } from '@/types/chat';
import { useIsMobile } from '@/logic/useMedia';
import { useChatSearch, useChatState } from '@/state/chat';
import ChatScrollerPlaceholder from '../ChatScoller/ChatScrollerPlaceholder';
import ChatSearchResult from './ChatSearchResult';

interface ChatSearchResultsProps {
  whom: string;
  query?: string;
}

function itemContent(
  _i: number,
  [whom, key, writ, msgLoad]: [
    string,
    BigInteger,
    ChatWrit,
    (time: BigInteger, type: 'click' | 'hover') => void
  ]
) {
  return (
    <div className="pb-2 pr-2">
      <ChatSearchResult whom={whom} writ={writ} time={key} msgLoad={msgLoad} />
    </div>
  );
}

export default function ChatSearchResults({
  whom,
  query,
}: ChatSearchResultsProps) {
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const { scan, isLoading } = useChatSearch(whom, query || '');
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
      ? [...scan].map(
          ([int, writ]) =>
            [whom, int, writ, msgLoad] as [
              string,
              BigInteger,
              ChatWrit,
              (time: BigInteger, type: 'click' | 'hover') => void
            ]
        )
      : [];
  }, [scan, whom, msgLoad]);

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

  useEffect(() => {
    useChatStore.getState().setCurrent(whom);
  }, [whom]);

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
        <div className="flex-1">
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
          ref={scrollerRef}
          data={entries}
          itemContent={itemContent}
          computeItemKey={(i, item) => item[1].toString()}
          className="h-full w-full list-none overflow-x-hidden overflow-y-scroll"
        />
      )}
    </div>
  );
}
