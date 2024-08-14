import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

export function useRefetchQueryOnFocus<T>(refetch: () => Promise<T>) {
  const firstTimeRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstTimeRef.current) {
        firstTimeRef.current = false;
        return;
      }
      refetch();
    }, [refetch])
  );
}
