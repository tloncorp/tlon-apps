import { daToUnix, parseUd } from '@urbit/aura';
import { isSameDay } from 'date-fns';
import _ from 'lodash';
import { useMemo } from 'react';

import {
  emptySummary,
  useAllEvents,
  useSourceActivity,
} from '@/state/activity';

export function useNotifications() {
  const { activity } = useSourceActivity('base');
  const { data, status, ...rest } = useAllEvents();
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

  const notifications = useMemo(
    () =>
      all.feed
        .sort((a, b) => b.latest.localeCompare(a.latest))
        .map((b, index) => {
          const myDay = new Date(daToUnix(parseUd(b.latest)));
          const prevDay =
            index === 0
              ? null
              : new Date(daToUnix(parseUd(all.feed[index - 1].latest)));
          const newDay = prevDay === null ? true : !isSameDay(myDay, prevDay);

          return {
            bundle: b,
            summary: all.summaries[b['source-key']] || emptySummary,
            newDay,
            date: myDay,
          };
        }),
    [all]
  );

  if (status !== 'success') {
    return {
      ...rest,
      notifications: [],
      activity,
      loaded: status === 'error',
    };
  }

  return {
    ...rest,
    notifications,
    activity,
    loaded: status === 'success' || status === 'error',
  };
}
