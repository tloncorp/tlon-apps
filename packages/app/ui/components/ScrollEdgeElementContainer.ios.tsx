import { requireNativeViewManager } from 'expo-modules-core';
import { PropsWithChildren } from 'react';
import { ViewProps } from 'react-native';

type ScrollEdgeElementContainerProps = PropsWithChildren<
  ViewProps & {
    edge?: 'top' | 'bottom';
    scrollViewNativeID: string;
  }
>;

const NativeScrollEdgeElementContainer =
  requireNativeViewManager<ScrollEdgeElementContainerProps>(
    'TlonScrollEdgeEffect',
    'ScrollEdgeElementContainer'
  );

export function ScrollEdgeElementContainer({
  children,
  edge = 'bottom',
  scrollViewNativeID,
  ...props
}: ScrollEdgeElementContainerProps) {
  return (
    <NativeScrollEdgeElementContainer
      {...props}
      edge={edge}
      scrollViewNativeID={scrollViewNativeID}
    >
      {children}
    </NativeScrollEdgeElementContainer>
  );
}
