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

  // Resolves false when the platform refuses the write; Expo reports that
  // with a boolean rather than a rejection.
  const doCopy = useCallback(async (): Promise<boolean> => {
    const copiedOk = await Clipboard.setStringAsync(copied);
    if (!copiedOk) {
      return false;
    }
    setDidCopy(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setDidCopy(false);
    }, 2000);
    return true;
  }, [copied]);

  return { doCopy, didCopy };
}
