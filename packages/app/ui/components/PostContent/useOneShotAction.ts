import { useCallback, useEffect, useRef, useState } from 'react';

/** Run cleanup when a durable receipt that was once present is deleted. */
export function useDurableRelease(
  durablyConsumed: boolean,
  onRelease: () => void
) {
  const observedRef = useRef(false);

  useEffect(() => {
    if (durablyConsumed) {
      observedRef.current = true;
      return;
    }
    if (!observedRef.current) return;
    observedRef.current = false;
    onRelease();
  }, [durablyConsumed, onRelease]);
}

/**
 * Synchronously lock a one-shot control, release it on failure, and keep it
 * locked until its durable receipt is deleted.
 */
export function useOneShotAction(durablyConsumed: boolean) {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [consumedLocally, setConsumedLocally] = useState(false);

  const release = useCallback(() => {
    lockRef.current = false;
    setPending(false);
    setConsumedLocally(false);
  }, []);
  useDurableRelease(durablyConsumed, release);

  const run = useCallback(async (action: () => void | Promise<void>) => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setPending(true);
    try {
      await action();
      setConsumedLocally(true);
      return true;
    } catch {
      lockRef.current = false;
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    consumed: durablyConsumed || consumedLocally,
    consumedLocally,
    isLocked: () => lockRef.current,
    pending,
    run,
  };
}
