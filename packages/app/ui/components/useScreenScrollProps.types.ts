import type { ScrollViewProps } from 'react-native';

export type ScreenScrollProps = Pick<
  ScrollViewProps,
  'contentInsetAdjustmentBehavior'
>;

export interface UseScreenScrollPropsOptions {
  enabled?: boolean;
}
