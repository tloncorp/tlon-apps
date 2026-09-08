import type { PropsWithChildren, RefAttributes } from 'react';
import type { View, ViewProps, PressableProps } from 'react-native';

export type NativeReadContainerProps = PropsWithChildren<ViewProps> &
  RefAttributes<View> &
  Pick<
    PressableProps,
    | 'onPress'
    | 'onPressIn'
    | 'onPressOut'
    | 'onLongPress'
    | 'disabled'
    | 'delayLongPress'
  > & { descriptor?: string; delayPressIn?: number; delayPressOut?: number };
