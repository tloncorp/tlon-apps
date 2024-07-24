import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const useAppForegrounded = (callback: (() => void) | (() => Promise<void>)) => {
  const [appState, setAppState] = useState(AppState.currentState);

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        callback();
      }
      setAppState(nextAppState);
    },
    [appState, callback]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [callback, handleAppStateChange]);
};

export default useAppForegrounded;
