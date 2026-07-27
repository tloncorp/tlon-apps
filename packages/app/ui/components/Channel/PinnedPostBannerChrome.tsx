import { PropsWithChildren } from 'react';
import { View } from 'react-native';

export const usesFloatingPinnedPostBanner = false;

export function PinnedPostBannerChrome({
  children,
}: PropsWithChildren<object>) {
  return <View>{children}</View>;
}
