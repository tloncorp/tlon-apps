import { useMemo } from 'react';

import { WrappedQuery } from '../db/query';

export interface TableDependecies {
  groups: boolean;
  pins: boolean;
  contacts: boolean;
  channels: boolean;
  unreads: boolean;
  posts: boolean;
}

export function useKeyFromQueryDeps(
  query: WrappedQuery<any, any>,
  options?: any
) {
  return useMemo(() => keyFromQueryDeps(query, options), [query, options]);
}

function keyFromQueryDeps(query: WrappedQuery<any, any>, options?: any) {
  return new Set(
    query.meta.tableDependencies instanceof Function
      ? query.meta.tableDependencies(options)
      : query.meta.tableDependencies
  );
}
