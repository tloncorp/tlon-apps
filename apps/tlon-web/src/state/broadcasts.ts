
import useReactQueryScry from '@/logic/useReactQueryScry';
import queryClient from '@/queryClient';
import { UseQueryResult } from '@tanstack/react-query';
import { daToDate, unixToDa } from '@urbit/api';
import { WritTuple } from 'packages/shared/dist/urbit/dms';
import { Story, WritEssay, Inline } from 'packages/shared/dist/urbit';

export const cohortsKey = () => ['broadcaster', 'cohorts'];

type CohortKey = string; // encoded @t
export type Cohort = {
  title: string,
  logging: CohortLog[],
  targets: string[], // ~ship names
}
type CohortLog = {
  wen: string, // encoded @da
  log: CohortLogAdd | CohortLogDel | CohortLogMsg | CohortLogErr,
}
interface CohortLogAdd { add: string[] } // ~ship names
interface CohortLogDel { del: string[] } // ~ship names
interface CohortLogMsg { msg: Story }
interface CohortLogErr { err: string }
export type Cohorts = { [x: CohortKey]: Cohort };

export type CohortUnread = {
  recency: number,
  count: number,
  unread: null,
  threads: null,
}

export function bootstrapCohorts(cohorts: Cohorts) {
  queryClient.setQueryData(cohortsKey(), cohorts);
}

export function useCohorts(): UseQueryResult<Cohorts> {
  return useReactQueryScry<Cohorts>({
    queryKey: cohortsKey(),
    app: 'broadcaster',
    path: '/cohorts/json',
  });
}

export function useCohort(k: CohortKey): Cohort {
  return (useCohorts().data || {})[k] || { logging: [], targets: [] };
}

export function cohortToUnread(cohort: Cohort): CohortUnread {
  return {
    recency: cohort.logging.length === 0 ? 0 : daToDate(cohort.logging[0].wen).getTime(),
    count: 0,
    unread: null,
    threads: null,
  }
}

export function cohortLogToWrit(log: CohortLog): WritTuple {
  const time = unixToDa(daToDate(log.wen).getTime());
  const seal = {
    time: log.wen,
    id: log.wen,
    reacts: {},
    replies: null,
    meta: { replyCount: 0, lastRepliers: [], lastReply: null }
  }
  const essay: WritEssay = {
    content: [],
    author: window.our,
    sent: Math.floor(daToDate(log.wen).getTime() / 1000),
    'kind-data': { chat: null },
  };
  if ('msg' in log.log) {
    essay.content = log.log.msg;
  } else
  if ('add' in log.log || 'del' in log.log || 'err' in log.log) {
    essay['kind-data'] = { chat: { notice: null } };
    if ('add' in log.log) {
      const listing: Inline[] = log.log.add.flatMap(s => [{ship: s}, ', ']).slice(0,-1);
      essay.content = [{ inline: ['added: ', ...listing] }];
    } else
    if ('del' in log.log) {
      const listing: Inline[] = log.log.del.flatMap(s => [{ship: s}, ', ']).slice(0,-1);
      essay.content = [{ inline: ['removed: ', ...listing] }];
    } else
    if ('err' in log.log) {
      essay.content = [{ inline: [log.log.err] }];
    }
  }
  return [time, { seal, essay }];
}
