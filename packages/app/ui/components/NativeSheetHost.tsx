import { BottomSheet } from '@expo/ui/community/bottom-sheet';

import type { NativeSheetHostProps } from './NativeSheetHost.types';

// iOS presents through Expo UI's sheet as it is: SwiftUI keeps the sheet clear
// of the keyboard itself. Android has its own host, which takes the two extra
// props.
export function NativeSheetHost({
  footer: _footer,
  onCoveredHeightChange: _onCoveredHeightChange,
  ...props
}: NativeSheetHostProps) {
  return <BottomSheet {...props} />;
}
