import { UseQueryResult } from '@tanstack/react-query';
import {
  ActivitySummary,
  Inline,
  Story,
  WritEssay,
} from '@tloncorp/shared/urbit';
import { WritTuple } from '@tloncorp/shared/urbit/dms';
import { daToDate, unixToDa } from '@urbit/api';

import api from '@/api';
import useReactQueryScry from '@/logic/useReactQueryScry';
import queryClient from '@/queryClient';

export const cohortsKey = () => ['broadcaster', 'cohorts'];

type CohortKey = string; // encoded @t
export type Cohort = {
  title: string;
  logging: CohortLog[];
  targets: string[]; // ~ship names
};
type CohortLog = {
  wen: string; // encoded @da
  log: CohortLogAdd | CohortLogDel | CohortLogMsg | CohortLogErr;
};
interface CohortLogAdd {
  add: string[]; // ~ship names
}
interface CohortLogDel {
  del: string[]; // ~ship names
}
interface CohortLogMsg {
  msg: Story;
}
interface CohortLogErr {
  err: string;
}
export type Cohorts = { [x: CohortKey]: Cohort };

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

export function cohortToUnread(cohort: Cohort): ActivitySummary {
  const recency =
    cohort.logging.length === 0 ? 0 : daToDate(cohort.logging[0].wen).getTime();
  return {
    recency,
    count: 0,
    notify: false,
    unread: null,
    'notify-count': 0,
  };
}

export function cohortLogToWrit(log: CohortLog): WritTuple {
  const time = unixToDa(daToDate(log.wen).getTime());
  const seal = {
    time: log.wen,
    id: log.wen,
    reacts: {},
    replies: null,
    meta: { replyCount: 0, lastRepliers: [], lastReply: null },
  };
  const essay: WritEssay = {
    content: [],
    author: window.our,
    sent: Math.floor(daToDate(log.wen).getTime() / 1000),
    'kind-data': { chat: null },
  };
  if ('msg' in log.log) {
    essay.content = log.log.msg;
  } else if ('add' in log.log || 'del' in log.log || 'err' in log.log) {
    essay['kind-data'] = { chat: { notice: null } };
    if ('add' in log.log) {
      const listing: Inline[] = log.log.add
        .flatMap((s) => [{ ship: s }, ', '])
        .slice(0, -1);
      essay.content = [{ inline: ['added: ', ...listing] }];
    } else if ('del' in log.log) {
      const listing: Inline[] = log.log.del
        .flatMap((s) => [{ ship: s }, ', '])
        .slice(0, -1);
      essay.content = [{ inline: ['removed: ', ...listing] }];
    } else if ('err' in log.log) {
      essay.content = [{ inline: [log.log.err] }];
    }
  }
  return [time, { seal, essay }];
}

export function modifyCohort(
  cohort: CohortKey,
  add: boolean,
  targets: string[],
  onSuccess?: () => void,
  onError?: () => void
) {
  let json: object = { cohort, targets };
  if (add) {
    json = { 'add-cohort': json };
  } else {
    json = { 'del-cohort': json };
  }
  api.poke({
    mark: 'broadcaster-action',
    app: 'broadcaster',
    json,
    onSuccess: () => {
      //TODO refetch only the affected cohort
      queryClient.refetchQueries(cohortsKey());
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });
}

export function broadcast(
  cohort: CohortKey,
  story: Story,
  onSuccess?: () => void,
  onError?: () => void
) {
  const json = { broadcast: { cohort, story } };
  api.poke({
    mark: 'broadcaster-action',
    app: 'broadcaster',
    json,
    onSuccess: () => {
      //TODO refetch just the affected cohort
      queryClient.refetchQueries(cohortsKey());
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });
}

export function deleteBroadcast(
  cohort: CohortKey,
  timeId: string,
  onSuccess?: () => void,
  onError?: () => void
) {
  const json = { delete: { cohort, 'time-id': timeId } };
  api.poke({
    mark: 'broadcaster-action',
    app: 'broadcaster',
    json,
    onSuccess: () => {
      //TODO refetch just the affected cohort
      queryClient.refetchQueries(cohortsKey());
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });
}
