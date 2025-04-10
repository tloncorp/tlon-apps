import { useCallback } from 'react';
import { useErrorHandler as useBoundaryHandler } from 'react-error-boundary';

export default function useErrorHandler() {
  const handle = useBoundaryHandler();

  return useCallback(
    (cb: (...args: any[]) => any) =>
      (...args: any[]) => {
        try {
          cb(...args);
        } catch (error) {
          handle(error);
        }
      },
    [handle]
  );
}
