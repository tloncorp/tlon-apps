import { replaceEqualDeep } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Creates a ref whose current value is always the value as of last render.
 * Useful for preventing callbacks from changing and triggering rerenders.
 */
export const useLiveRef = <T>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

/**
 * Minimizes churn for queries that return similar results repeatedly. Uses
 * react-query's `replaceEqualDeep` to ensure that we only return new objects
 * when the data belonging to those objects has changed.
 */
export function useOptimizedQueryResults<T extends { id: string }>(
  value: T[] | null | undefined
) {
  const lastValueRef = useRef(value);
  return useMemo(() => {
    const lastPostsMap: Record<string, T> =
      lastValueRef.current?.reduce<Record<string, T>>((memo, p) => {
        memo[p.id] = p;
        return memo;
      }, {}) ?? {};
    lastValueRef.current = value;
    return (
      value?.map((p) =>
        lastPostsMap[p.id] ? replaceEqualDeep(lastPostsMap[p.id], p) : p
      ) ?? null
    );
  }, [value]);
}

export function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

export function useMutableRef<T>(initialValue: T): { current: T } {
  const ref = useRef(initialValue);
  ref.current = initialValue;
  return ref;
}

export function useMutableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const callbackRef = useMutableRef(callback);
  return useCallback((...args) => callbackRef.current(...args), [callbackRef]);
}
