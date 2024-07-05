import { daToUnix, parseUd } from '@urbit/aura';
import _ from 'lodash';
import { ActivityBundle } from 'packages/shared/dist/urbit';
import { useMemo } from 'react';

import { makePrettyDay } from '@/logic/utils';
import { useAllEvents } from '@/state/activity';
import { useUnread } from '@/state/unreads';

export interface DayGrouping {
  date: string;
  latest: number;
  bundles: ActivityBundle[];
}

function groupBundlesByDate(bundles: ActivityBundle[]): DayGrouping[] {
  const groups = _.groupBy(bundles, (b) =>
    makePrettyDay(new Date(daToUnix(parseUd(b.latest))))
  );

  return Object.entries(groups)
    .map(([k, v]) => ({
      date: k,
      latest: daToUnix(parseUd(_.head(v)?.latest || '0')),
      bundles: v.sort((a, b) => b.latest.localeCompare(a.latest)),
    }))
    .sort((a, b) => b.latest - a.latest);
}

export function useNotifications() {
  const unread = useUnread('base');
  const { data, status } = useAllEvents();
  const bundles = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  if (status !== 'success') {
    return {
      notifications: [],
      unread,
      loaded: status === 'error',
    };
  }

  const notifications = groupBundlesByDate(bundles);

  return {
    notifications,
    unread,
    loaded: status === 'success' || status === 'error',
  };
}
