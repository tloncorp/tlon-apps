import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';

type ScrollEdgeElementContainerProps = PropsWithChildren<
  ViewProps & {
    edge?: 'top' | 'bottom';
    scrollViewNativeID: string;
  }
>;

export function ScrollEdgeElementContainer({
  edge: _edge,
  scrollViewNativeID: _scrollViewNativeID,
  ...props
}: ScrollEdgeElementContainerProps) {
  return <View {...props} />;
}
