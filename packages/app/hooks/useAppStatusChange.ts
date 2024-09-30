import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export const useAppStatusChange = (
  callback: (status: AppStateStatus) => void | Promise<void>
) => {
  const appStateRef = useRef<AppStateStatus | null>(AppState.currentState);

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
