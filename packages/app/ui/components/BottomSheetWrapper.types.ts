import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';

export interface BottomSheetWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;

  // Animation & behavior
  animation?: 'quick' | 'medium' | 'slow';
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
  enableContentPanningGesture?: boolean;

  // Disable keyboard avoidance for sheets with inputs
  disableKeyboardAvoidance?: boolean;
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
