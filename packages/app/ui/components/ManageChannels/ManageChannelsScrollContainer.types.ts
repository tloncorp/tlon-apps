import { ReactNode } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ManageChannelsScrollRef = AnimatedRef<any> | undefined;

export interface ManageChannelsScrollContainerProps {
  children: ReactNode;
  paddingBottom: number;
}

export type UseManageChannelsScrollRef = () => ManageChannelsScrollRef;
