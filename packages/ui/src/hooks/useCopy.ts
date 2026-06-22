import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCopy(copied: string) {
  const [didCopy, setDidCopy] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const doCopy = useCallback(async () => {
    await Clipboard.setStringAsync(copied);
    setDidCopy(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setDidCopy(false);
    }, 2000);
  }, [copied]);

  return { doCopy, didCopy };
}
