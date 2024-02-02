import {useMemo} from 'react';

export function useBoundHandler<T>(model: T, handler?: (model: T) => void) {
  return useMemo(() => {
    return handler ? () => handler(model) : undefined;
  }, [model, handler]);
}
