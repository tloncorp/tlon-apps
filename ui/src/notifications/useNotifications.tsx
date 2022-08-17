import { useCallback } from 'react';
import useHarkState, {
  emptyBlanket,
  emptyCarpet,
  HarkState,
} from '@/state/hark';
import { Flag, Thread, Yarn, Yarns } from '@/types/hark';
import _ from 'lodash';
import { makePrettyDay } from '@/logic/utils';

export interface Bin {
  time: number;
  count: number;
  shipCount: number;
  topYarn: Yarn;
  unread: boolean;
}

export interface DayGrouping {
  date: string;
  latest: number;
  bins: Bin[];
}

function getYarns(thread: Thread, yarns: Yarns) {
  return _.values(_.pickBy(yarns, (v, k) => thread.includes(k))).sort(
    (a, b) => b.time - a.time
  );
}

function getBin(thread: Thread, yarns: Yarns, unread: boolean): Bin {
  const ys = getYarns(thread, yarns);
  const topYarn = _.head(ys) as Yarn;
  const shipCount = _.uniqBy(
    ys,
    (y) =>
      (
        y.con.find((con) => typeof con !== 'string' && 'ship' in con) as {
          ship: string;
        }
      )?.ship
  ).length;

  return {
    time: topYarn?.time || 0,
    count: thread.length,
    shipCount,
    unread,
    topYarn,
  };
}

export function groupBinsByDate(bins: Bin[]): DayGrouping[] {
  const groups = _.groupBy(bins, (b) => makePrettyDay(new Date(b.time)));

  return Object.entries(groups)
    .map(([k, v]) => ({
      date: k,
      latest: _.head(v)?.time || 0,
      bins: v.sort((a, b) => b.time - a.time),
    }))
    .sort((a, b) => b.latest - a.latest);
}

const selNotifications = (state: HarkState) => ({
  carpet: state.carpet,
  blanket: state.blanket,
});
export const useNotifications = () => {
  const { carpet, blanket } = useHarkState(selNotifications);
  const bins: Bin[] = carpet.cable.map((c) =>
    getBin(c.thread, carpet.yarns, true)
  );
  const oldBins: Bin[] = Object.values(blanket.quilt).map((t) =>
    getBin(t, blanket.yarns, false)
  );
  const notifications: DayGrouping[] = groupBinsByDate(bins.concat(oldBins));

  return {
    count: carpet.cable.length,
    notifications,
  };
};

export const useGroupNotifications = (flag: Flag) => {
  const { carpet, blanket } = useHarkState(
    useCallback(
      (state) =>
        state.textiles[flag] || {
          carpet: emptyCarpet({ group: flag }),
          blanket: emptyBlanket({ group: flag }),
        },
      [flag]
    )
  );

  return {
    count: carpet.cable.length,
    carpet,
    blanket,
  };
};
