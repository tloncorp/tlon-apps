import fuzzy from 'fuzzy';
import { useGangs, useGroups } from '@/state/groups';
import { deSig } from '@urbit/api';
import { useMemo } from 'react';
import { Gangs, Groups } from '@/types/groups';
import _ from 'lodash';

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

  return searchSpace.filter(
    (record) =>
      record.title.toLowerCase().startsWith(query.toLowerCase()) ||
      deSig(record.flag)?.startsWith(deSig(query) || '')
  );

}
