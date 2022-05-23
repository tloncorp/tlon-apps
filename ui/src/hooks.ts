/* eslint-disable import/prefer-default-export */
import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { useSearchParams } from 'react-router-dom';

export function useChannelFlag() {
  const { chShip, chName } = useParams();
  return useMemo(
    () => (chShip && chName ? `${chShip}/${chName}` : null),
    [chShip, chName]
  );
}

export function useSearchParam<T>(
  key: string
): [T | undefined, (update: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(() => {
    const v = searchParams.get(key);
    if (v) {
      return JSON.parse(decodeURIComponent(v));
    }
    return undefined;
  }, [key, searchParams]);

  const setValue = useCallback(
    (update: T) => {
      searchParams.delete(key);
      searchParams.append(key, JSON.stringify(update));
      setSearchParams(searchParams);
    },
    [key, searchParams, setSearchParams]
  );

  return [value, setValue];
}
