import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export type AppStatus = AppStateStatus | 'opened';

export const useAppStatusChange = (
  callback: (status: AppStatus) => void | Promise<void>
) => {
  const [signaledAppOpen, setSignaledAppOpen] = useState(false);
  const appStateRef = useRef<AppStateStatus | null>(AppState.currentState);

  useEffect(() => {
    if (!signaledAppOpen) {
      setSignaledAppOpen(true);
      callback('opened');
    }
  }, [callback, signaledAppOpen]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (appStateRef.current === null) {
        // initial app state is null
        return;
      } else {
        appStateRef.current = status;
        callback(status);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [callback]);
};
