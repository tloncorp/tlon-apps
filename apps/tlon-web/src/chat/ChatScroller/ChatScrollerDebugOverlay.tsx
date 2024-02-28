import cn from 'classnames';

function DebugBoolean({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={cn(value ? 'bg-green' : 'bg-red')}>
      {value ? '✔' : '✘'} {label}
    </div>
  );
}

export default function ChatScrollerDebugOverlay({
  count,
  anchorIndex,
  scrollHeight,
  scrollDirection,
  scrollOffset,
  isLoadingOlder,
  isLoadingNewer,
  hasLoadedNewest,
  hasLoadedOldest,
  isInverted,
  loadDirection,
  isAtBottom,
  isAtTop,
  userHasScrolled,
}: {
  count: number;
  anchorIndex?: number | null;
  scrollOffset: number;
  scrollHeight: number;
  scrollDirection: 'forward' | 'backward' | null;
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
  hasLoadedNewest: boolean;
  hasLoadedOldest: boolean;
  isInverted: boolean;
  loadDirection: 'newer' | 'older';
  isAtBottom: boolean;
  isAtTop: boolean;
  userHasScrolled: boolean;
}) {
  return (
    <div
      className={cn(
        'align-end absolute right-0 top-0 flex flex-col items-end text-right'
      )}
    >
      <div
        className={cn(
          isInverted ? 'bg-black text-white' : 'bg-white text-black'
        )}
      >
        {isInverted ? 'Inverted ▲' : 'Not Inverted ▼'}
      </div>
      <div className={cn(anchorIndex !== null ? 'bg-orange' : 'bg-gray-100')}>
        {anchorIndex !== null
          ? `Anchor index: ${anchorIndex}`
          : 'No anchor index'}
      </div>
      <label>
        {Math.round(scrollOffset)}/{scrollHeight}
      </label>
      <label>Load direction: {loadDirection}</label>
      <label>Scroll direction: {scrollDirection ?? 'none'}</label>
      <label> {count} items</label>
      <DebugBoolean label="User scrolled" value={userHasScrolled} />
      <DebugBoolean label="At bottom" value={isAtBottom} />
      <DebugBoolean label="At top" value={isAtTop} />
      <label className="mt-2">Top loader</label>
      <DebugBoolean label="Selected" value={loadDirection === 'older'} />
      <DebugBoolean label="Has loaded oldest" value={hasLoadedOldest} />
      <DebugBoolean label="Fetching" value={isLoadingOlder} />
      <label className="mt-2">Bottom loader</label>
      <DebugBoolean label="Selected" value={loadDirection === 'newer'} />
      <DebugBoolean label="Has loaded newest" value={hasLoadedNewest} />
      <DebugBoolean label="Fetching" value={isLoadingNewer} />
    </div>
  );
}
