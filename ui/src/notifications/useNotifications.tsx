import _ from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';
import useHarkState from '@/state/hark';
import { Flag, Skein, Thread, Yarn, Yarns } from '@/types/hark';
import { makePrettyDay } from '@/logic/utils';

export interface DayGrouping {
  date: string;
  latest: number;
  skeins: Skein[];
}

function groupSkeinsByDate(skeins: Skein[]): DayGrouping[] {
  const groups = _.groupBy(skeins, (b) => makePrettyDay(new Date(b.time)));

  return Object.entries(groups)
    .map(([k, v]) => ({
      date: k,
      latest: _.head(v)?.time || 0,
      skeins: v.sort((a, b) => b.time - a.time),
    }))
    .sort((a, b) => b.latest - a.latest);
}

export const isMention = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' mentioned you :');

export const isComment = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' commented on ');

export const isReply = (yarn: Yarn) =>
  yarn.con.some((con) => con === ' replied to your message “');

export const useNotifications = (
  flag?: Flag,
  mentionsOnly = false,
  refresh = false
) => {
  const { skeins, retrieve, retrieveGroup } = useHarkState(
    useCallback(
      (state) => {
        const sks = !flag ? state.skeins : state.textiles[flag] || [];

        return {
          skeins: sks,
          retrieve: state.retrieve,
          retrieveGroup: state.retrieveGroup,
        };
      },
      [flag]
    )
  );

  useEffect(() => {
    if (!refresh) {
      return;
    }

    if (flag) {
      retrieveGroup(flag);
    } else {
      retrieve();
    }
  }, [flag, refresh, retrieve, retrieveGroup]);

  return useMemo(() => {
    const unreads = skeins.filter((s) => s.unread);
    const filteredSkeins = skeins.filter((s) =>
      mentionsOnly ? isMention(s.top) : s
    );

    return {
      notifications: groupSkeinsByDate(filteredSkeins),
      mentions: unreads.filter((s) => isMention(s.top)),
      count: unreads.length,
    };
  }, [skeins, mentionsOnly]);
};
