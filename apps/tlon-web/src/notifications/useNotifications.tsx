import {
  ActivityBundle,
  ActivityFeed,
  ActivitySummary,
} from '@tloncorp/shared/dist/urbit';
import { daToUnix, parseUd } from '@urbit/aura';
import _ from 'lodash';
import { useMemo } from 'react';

import { makePrettyDay } from '@/logic/utils';
import {
  emptySummary,
  useAllEvents,
  useSourceActivity,
} from '@/state/activity';

export interface BundlePair {
  bundle: ActivityBundle;
  summary: ActivitySummary;
}

export interface DayGrouping {
  date: string;
  latest: number;
  bundles: BundlePair[];
}

function groupBundlesByDate(feed: ActivityFeed): DayGrouping[] {
  const groups = _.groupBy(feed.feed, (b) =>
    makePrettyDay(new Date(daToUnix(parseUd(b.latest))))
  );

  return Object.entries(groups)
    .map(([k, v]) => ({
      date: k,
      latest: daToUnix(parseUd(_.head(v)?.latest || '0')),
      bundles: v
        .sort((a, b) => b.latest.localeCompare(a.latest))
        .map((b) => ({
          bundle: b,
          summary: feed.summaries[b['source-key']] || emptySummary,
        })),
    }))
    .sort((a, b) => b.latest - a.latest);
}

export function useNotifications() {
  const { activity } = useSourceActivity('base');
  const { data, status } = useAllEvents();
  const all = useMemo(() => {
    if (!data) {
      return { feed: [], summaries: {} };
    }

    return data.pages.reduce(
      (acc, { feed, summaries }) => ({
        feed: [...feed, ...acc.feed],
        summaries: { ...summaries, ...acc.summaries },
      }),
      { feed: [], summaries: {} }
    );
  }, [data]);

  if (status !== 'success') {
    return {
      notifications: [],
      activity,
      loaded: status === 'error',
    };
  }

  const notifications = groupBundlesByDate(all);

  return {
    notifications,
    activity,
    loaded: status === 'success' || status === 'error',
  };
}
