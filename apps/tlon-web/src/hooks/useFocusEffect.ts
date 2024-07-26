import { useEffect, useRef } from 'react';
import useIsFocused from './useIsFocused';

function useFocusEffect(callback: () => void | (() => void), dependencies: any[] = []) {
  const isFocused = useIsFocused();
  const hasRun = useRef(false);

  useEffect(() => {
    if (isFocused) {
      const cleanup = callback();
      hasRun.current = true;

      return () => {
        if (cleanup) cleanup();
      };
    } else if (hasRun.current) {
      hasRun.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, callback, ...dependencies]);
}

export default useFocusEffect;
