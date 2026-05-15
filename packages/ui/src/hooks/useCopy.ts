import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';

export function useCopy(copied: string) {
  const [didCopy, setDidCopy] = useState(false);

  const doCopy = useCallback(async () => {
    await Clipboard.setStringAsync(copied);
    setDidCopy(true);

    const timeout = setTimeout(() => {
      setDidCopy(false);
    }, 2000);

    return () => {
      setDidCopy(false);
      clearTimeout(timeout);
    };
  }, [copied]);

  return { doCopy, didCopy };
}
