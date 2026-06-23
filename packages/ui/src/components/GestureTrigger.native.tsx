import * as React from 'react';
import { GestureTrigger as NativeGestureTrigger } from 'react-native-gesture-image-viewer';

type GestureTriggerProps = {
  children: React.ReactElement<{ onPress?: (...args: unknown[]) => void }>;
  id: string;
};

export function GestureTrigger({ children, id }: GestureTriggerProps) {
  return <NativeGestureTrigger id={id}>{children}</NativeGestureTrigger>;
}
