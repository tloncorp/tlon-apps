import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export default function useAppStatus() {
  const [status, setStatus] = useState<typeof AppState.currentState>(
    AppState.currentState
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextStatus) =>
      setStatus(nextStatus)
    );

    return () => {
      subscription.remove();
    };
  }, [status]);

  return status;
}
