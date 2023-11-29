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
  scrollOffset,
  hasLoadedNewest,
  hasLoadedOldest,
  isInverted,
  loadDirection,
  isAtBottom,
  isAtTop,
  fetchState,
  userHasScrolled,
}: {
  count: number;
  anchorIndex?: number | null;
  scrollOffset: number;
  scrollHeight: number;
  hasLoadedNewest: boolean;
  hasLoadedOldest: boolean;
  isInverted: boolean;
  loadDirection: 'newer' | 'older';
  isAtBottom: boolean;
  isAtTop: boolean;
  fetchState: 'initial' | 'top' | 'bottom';
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
      <label> {count} items</label>
      <DebugBoolean label="User scrolled" value={userHasScrolled} />
      <DebugBoolean label="At bottom" value={isAtBottom} />
      <DebugBoolean label="At top" value={isAtTop} />
      <label className="mt-2">Top loader</label>
      <DebugBoolean label="Selected" value={loadDirection === 'older'} />
      <DebugBoolean label="Has loaded oldest" value={hasLoadedOldest} />
      <DebugBoolean label="Fetching" value={fetchState === 'top'} />
      <label className="mt-2">Bottom loader</label>
      <DebugBoolean label="Selected" value={loadDirection === 'newer'} />
      <DebugBoolean label="Has loaded newest" value={hasLoadedNewest} />
      <DebugBoolean label="Fetching" value={fetchState === 'top'} />
    </div>
  );
}
