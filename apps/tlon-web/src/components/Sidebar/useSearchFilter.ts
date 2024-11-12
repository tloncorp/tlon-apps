import { Gangs, Groups } from '@tloncorp/shared/urbit/groups';
import { deSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import _ from 'lodash';
import { useMemo } from 'react';

import { useGangs, useGroups } from '@/state/groups';

export interface GroupSearchRecord {
  flag: string;
  title: string;
  type: 'group' | 'gang';
  status?: 'loading' | 'invited' | 'new' | undefined;
}

export function isGroupSearchRecord(record: any): record is GroupSearchRecord {
  return 'title' in record && 'flag' in record && 'type' in record;
}

function groupsToRecords(groups: Groups): GroupSearchRecord[] {
  return Object.entries(groups).map(([flag, group]) => ({
    flag,
    title: group.meta.title,
    type: 'group',
  }));
}

function gangsToRecords(gangs: Gangs): GroupSearchRecord[] {
  return Object.entries(gangs).map(([flag, gang]) => ({
    flag,
    title: gang.preview?.meta.title || '',
    type: 'gang',
  }));
}

export default function useSearchFilter(query: string): GroupSearchRecord[] {
  const groups = useGroups();
  const gangs = useGangs();

  const searchSpace = useMemo(() => {
    const comparator = (a: GroupSearchRecord, b: GroupSearchRecord) =>
      a.flag === b.flag;
    return _.uniqWith(
      [...groupsToRecords(groups), ...gangsToRecords(gangs)],
      comparator
    );
  }, [groups, gangs]);

  if (!query) {
    return [];
  }

  const matches = fuzzy.filter(query, searchSpace, {
    extract: (record) => record.title,
  });
  return matches
    .sort((a, b) => b.score - a.score)
    .map((result) => result.original);
}
