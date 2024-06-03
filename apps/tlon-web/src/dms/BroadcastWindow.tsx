import { WritTuple } from '@tloncorp/shared/dist/urbit/dms';
import { ReactElement, useMemo, useRef } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';

import ChatScroller from '@/chat/ChatScroller/ChatScroller';
import DMUnreadAlerts from '@/chat/DMUnreadAlerts';
import { useIsScrolling } from '@/logic/scroll';
import { cohortLogToWrit, useCohort } from '@/state/broadcasts';

interface BroadcastWindowProps {
  whom: string;
  root: string;
  prefixedElement?: ReactElement;
}

export default function BroadcastWindow({
  whom,
  root,
  prefixedElement,
}: BroadcastWindowProps) {
  const scrollerRef = useRef<VirtuosoHandle>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);

  const logs = useCohort(whom).logging;
  const writs: WritTuple[] = useMemo(() => {
    return logs.map(cohortLogToWrit).reverse();
  }, [logs]);

  return (
    <div className="relative h-full">
      <DMUnreadAlerts whom={whom} root={root} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ChatScroller
          /**
           * key=whom forces a remount for each channel switch
           * This resets the scroll position when switching channels;
           * previously, when switching between channels, the virtuoso
           * internal scroll index would remain the same. So, if one scrolled
           * far back in a long channel, then switched to a less active one,
           * the channel would be scrolled to the top.
           */
          key={whom}
          messages={writs}
          hideOptions={true}
          isLoadingOlder={false}
          isLoadingNewer={false}
          whom={whom}
          scrollTo={undefined}
          scrollerRef={scrollerRef}
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          topLoadEndMarker={prefixedElement}
          onAtTop={() => {
            return;
          }}
          onAtBottom={() => {
            return;
          }}
          hasLoadedOldest={true}
          hasLoadedNewest={true}
        />
      </div>
    </div>
  );
}
