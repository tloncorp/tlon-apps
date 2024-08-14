import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export default function useAppStatus() {
  const [status, setStatus] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextStatus: AppStateStatus) => setStatus(nextStatus)
    );

    return () => {
      subscription.remove();
    };
  }, [status]);

  return status;
}
