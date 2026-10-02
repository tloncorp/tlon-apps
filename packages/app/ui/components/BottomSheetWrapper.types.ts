import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';

export interface BottomSheetWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when native sheet content is laid out or its open detent changes. */
  onDidOpen?: () => void;
  /** Fires after native dismissal completes. */
  onDismiss?: () => void;
  children: ReactNode;

  dismissOnSnapToBottom?: boolean;

  // Snap points
  snapPointsMode?: 'fit' | 'percent' | 'constant';
  snapPoints?: Array<number | string>;

  showHandle?: boolean;
  footerComponent?: React.FC<any>;

  // Native only
  enablePanDownToClose?: boolean;
  enableContentPanningGesture?: boolean;

  /**
   * When `true`, the wrapper keeps the sheet subtree mounted until native
   * dismissal completes, then unmounts it, and mounts a fresh subtree on each
   * subsequent open. Native-only; ignored on web. Use this for sheets that
   * exhibit Android render desync after close (TLON-5664).
   */
  unmountOnClose?: boolean;
}

export interface BottomSheetScrollViewProps {
  children: ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showsVerticalScrollIndicator?: boolean;
  alwaysBounceVertical?: boolean;
  automaticallyAdjustsScrollIndicatorInsets?: boolean;
  scrollIndicatorInsets?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}
