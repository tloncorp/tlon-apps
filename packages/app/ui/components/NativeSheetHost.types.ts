import type { BottomSheetProps } from '@expo/ui/community/bottom-sheet';
import type { ReactNode } from 'react';

export type NativeSheetHostProps = BottomSheetProps & {
  /**
   * Content pinned to the bottom of a fixed-height sheet, above the keyboard.
   * Android only: it is laid out natively so it stays on the keyboard's edge
   * while the keyboard moves. Pass `null` to keep the slot with nothing in it.
   */
  footer?: ReactNode;
  /**
   * Android only. Reports how much of the bottom of a fixed-height sheet's
   * content is hidden behind the footer and the keyboard.
   */
  onCoveredHeightChange?: (height: number) => void;
};
