import * as Tabs from '@radix-ui/react-tabs';
import cn from 'classnames';
import _ from 'lodash';
import { useMemo, useState } from 'react';

import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';

function byShortcode(a: [string, string], b: [string, string]) {
  const aCode = a[1];
  const bCode = b[1];
  return aCode.localeCompare(bCode);
}

function ReactRow({ shortcode, ship }: { shortcode: string; ship: string }) {
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

function ReactTab({
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
  reacts: Record<string, string>;
  className?: string;
}

export default function ReactionsWidget({
  reacts,
  className,
}: ReactionsDisplayProps) {
  const [selectedTab, setSelectedTab] = useState('all');

  const reactCount = useMemo(() => Object.keys(reacts).length, [reacts]);
  const reactsByShortcode = useMemo(() => _.invertBy(reacts), [reacts]);
  const allReacts = useMemo(
    () => Object.entries(reacts).sort(byShortcode),
    [reacts]
  );
  const allShortcodes = useMemo(
    () => Object.entries(reactsByShortcode).map(([code]) => code),
    [reactsByShortcode]
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
            <ReactTab
              tabId={tabId}
              count={
                tabId === 'all' ? reactCount : reactsByShortcode[tabId].length
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
            allReacts.map(([ship, shortcode]) => (
              <ReactRow key={ship} ship={ship} shortcode={shortcode} />
            ))}
          {tabId !== 'all' &&
            reactsByShortcode[tabId].map((ship) => (
              <ReactRow key={ship} ship={ship} shortcode={tabId} />
            ))}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
