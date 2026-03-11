import { useEffect, useRef } from 'react';

export function useInterval(
  fn: (() => void) | null,
  intervalMs: number,
  enabled = true
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = setInterval(() => {
      fnRef.current?.();
    }, intervalMs);
    return () => clearInterval(handle);
  }, [fnRef, intervalMs, enabled]);
}
