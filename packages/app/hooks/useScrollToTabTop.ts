import { useScrollToTop } from '@react-navigation/native';
import { RefObject, useRef } from 'react';

export function useScrollToTabTop<T>(): RefObject<T | null> {
  const scrollRef = useRef<T | null>(null);
  useScrollToTop(scrollRef as Parameters<typeof useScrollToTop>[0]);
  return scrollRef;
}
