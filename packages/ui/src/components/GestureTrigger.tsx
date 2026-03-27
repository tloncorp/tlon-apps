import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';

type GestureTriggerComponent = (
  props: PropsWithChildren<{ id: string }>
) => React.ReactElement | null;

let NativeGestureTrigger: GestureTriggerComponent | null = null;

if (Platform.OS !== 'web') {
  NativeGestureTrigger = (
    require('react-native-gesture-image-viewer') as {
      GestureTrigger: GestureTriggerComponent;
    }
  ).GestureTrigger;
}

export function GestureTrigger({
  children,
  id,
}: PropsWithChildren<{
  id: string;
}>) {
  if (Platform.OS === 'web' || !NativeGestureTrigger) {
    return <>{children}</>;
  }

  return <NativeGestureTrigger id={id}>{children}</NativeGestureTrigger>;
}
