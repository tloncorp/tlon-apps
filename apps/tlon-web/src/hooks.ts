import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

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
