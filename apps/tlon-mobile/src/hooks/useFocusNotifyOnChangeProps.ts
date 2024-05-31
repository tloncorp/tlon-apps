import { useFocusEffect } from '@react-navigation/native';
import { NotifyOnChangeProps } from '@tanstack/query-core';
import React from 'react';

export function useFocusNotifyOnChangeProps(
  notifyOnChangeProps?: NotifyOnChangeProps
): NotifyOnChangeProps {
  const focusedRef = React.useRef(true);

  useFocusEffect(
    React.useCallback(() => {
      focusedRef.current = true;

      return () => {
        focusedRef.current = false;
      };
    }, [])
  );

  return () => {
    if (!focusedRef.current) {
      return [];
    }

    if (typeof notifyOnChangeProps === 'function') {
      return notifyOnChangeProps();
    }

    return notifyOnChangeProps ?? 'all';
  };
}
