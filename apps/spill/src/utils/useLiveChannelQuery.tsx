import * as db from '@db';
import {DependencyList, useCallback, useMemo, useState} from 'react';
import {syncPostsBefore} from './sync';

export function useLiveChannelQuery(
  querySettings: db.StreamQuerySettings | null | undefined,
  deps: DependencyList,
) {
  const ops = db.useOps();
  const pageSize = 20;
  const [[startIndex, endIndex], setRange] = useState([0, 20]);
  const query = db.useStreamQuery(querySettings, deps);
  const loadMoreAtStart = useCallback(() => {
    const nextStartIndex = Math.max(endIndex[1] - pageSize, 0);
    if (nextStartIndex !== startIndex) {
      setRange([nextStartIndex, endIndex]);
    }
  }, [startIndex, endIndex]);
  const loadMoreAtEnd = useCallback(async () => {
    const nextEndIndex = Math.min(endIndex + 20, query.length - 1);
    if (nextEndIndex !== endIndex) {
      setRange([startIndex, nextEndIndex]);
    } else if (query.length) {
      await syncPostsBefore(query[query.length - 1]!, ops);
      setRange([startIndex, query.length - 1]);
    }
  }, [startIndex, endIndex, query, ops]);
  const getItemIndex = useCallback(
    (searchElement: db.Post) => {
      return query.indexOf(searchElement) - startIndex;
    },
    [query, startIndex],
  );
  const results = useMemo(() => {
    return query.slice(startIndex, endIndex);
  }, [startIndex, endIndex, query]);
  return {
    query,
    querySlice: results,
    loadMoreAtEnd,
    loadMoreAtStart,
    getItemIndex,
  };
}
