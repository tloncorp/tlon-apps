import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';

export interface BottomSheetWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;

  // Animation & behavior
  transition?: 'quick' | 'medium' | 'slow';
  dismissOnSnapToBottom?: boolean;
  handleDisableScroll?: boolean;

  // Snap points
  snapPointsMode?: 'fit' | 'percent' | 'constant';
  snapPoints?: Array<number | string>;

  // Styling
  frameStyle?: ViewStyle;

  // Modal behavior
  modal?: boolean;

  // Handle
  showHandle?: boolean;

  // Footer
  footerComponent?: React.FC<any>;

  // Scrollable content handling
  hasScrollableContent?: boolean;

  // Overlay
  showOverlay?: boolean;
  overlayOpacity?: number;

  // Platform specific - used by native implementation
  enablePanDownToClose?: boolean;
  keyboardBehavior?: 'interactive' | 'fillParent' | 'extend';
  android_keyboardInputMode?: 'adjustPan' | 'adjustResize';
  enableDynamicSizing?: boolean;
  enableContentPanningGesture?: boolean;

  // Disable keyboard avoidance for sheets with inputs
  disableKeyboardAvoidance?: boolean;

  /**
   * When `true`, the wrapper unmounts the underlying sheet subtree after each
   * close (allowing the close animation to play first), and re-mounts a fresh
   * subtree on each subsequent open. Native-only; ignored on web. Use this for
   * sheets that exhibit Android render desync after close (TLON-5664).
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
