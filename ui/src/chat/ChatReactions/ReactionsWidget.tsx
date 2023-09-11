import _ from 'lodash';
import { useMemo, useState } from 'react';
import * as cn from 'classnames';
import * as Tabs from '@radix-ui/react-tabs';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';

function byShortcode(a: [string, string], b: [string, string]) {
  const aCode = a[1];
  const bCode = b[1];
  return aCode.localeCompare(bCode);
}

function FeelRow({ shortcode, ship }: { shortcode: string; ship: string }) {
  return (
    <div className="mb-4 flex w-full items-center justify-between">
      <div className="flex items-center">
        <Avatar ship={ship} size="small" />
        <ShipName className="ml-3" name={ship} showAlias />
      </div>
      <em-emoji shortcodes={shortcode} size="1.3em" />
    </div>
  );
}

function FeelTab({
  tabId,
  count,
  selected,
}: {
  tabId: string;
  count: number;
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg px-3 py-3',
        selected && 'bg-blue-100'
      )}
    >
      {tabId === 'all' ? (
        <span className={cn('font-semibold', selected && 'text-blue')}>
          All
        </span>
      ) : (
        <em-emoji shortcodes={tabId} size="1.3em" />
      )}
      <span className={cn('ml-2', selected && 'font-semibold text-blue')}>
        {count}
      </span>
    </div>
  );
}

interface ReactionsDisplayProps {
  feels: Record<string, string>;
  className?: string;
}

export default function ReactionsWidget({
  feels,
  className,
}: ReactionsDisplayProps) {
  const [selectedTab, setSelectedTab] = useState('all');

  const feelCount = useMemo(() => Object.keys(feels).length, [feels]);
  const feelsByShortcode = useMemo(() => _.invertBy(feels), [feels]);
  const allFeels = useMemo(
    () => Object.entries(feels).sort(byShortcode),
    [feels]
  );
  const allShortcodes = useMemo(
    () => Object.entries(feelsByShortcode).map(([code]) => code),
    [feelsByShortcode]
  );
  const tabIds = ['all', ...allShortcodes];

  return (
    <Tabs.Root
      className={cn('flex w-full flex-col', className)}
      defaultValue="all"
      value={selectedTab}
      aria-label="View Reactions"
    >
      <Tabs.List className="mb-6 ml-2 mr-5 flex overflow-auto hide-scrollbar">
        {tabIds.map((tabId) => (
          <Tabs.Trigger
            key={tabId}
            value={tabId}
            className="flex items-center"
            onClick={() => setSelectedTab(tabId)}
            aria-label={tabId === 'all' ? 'All Reactions' : tabId}
          >
            <FeelTab
              tabId={tabId}
              count={
                tabId === 'all' ? feelCount : feelsByShortcode[tabId].length
              }
              selected={selectedTab === tabId}
            />
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabIds.map((tabId) => (
        <Tabs.Content
          key={tabId}
          value={tabId}
          className="h-full overflow-y-auto pl-3 pr-5"
        >
          {tabId === 'all' &&
            allFeels.map(([ship, shortcode]) => (
              <FeelRow key={ship} ship={ship} shortcode={shortcode} />
            ))}
          {tabId !== 'all' &&
            feelsByShortcode[tabId].map((ship) => (
              <FeelRow key={ship} ship={ship} shortcode={tabId} />
            ))}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
