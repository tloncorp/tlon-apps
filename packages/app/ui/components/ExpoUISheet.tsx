import type {
  ExpoUIActionContentProps,
  ExpoUIPaneStackProps,
  ExpoUISheetProps,
} from './ExpoUISheet.types';

// Desktop web does not use the native Expo UI sheet renderer.
export function ExpoUISheet(_props: ExpoUISheetProps) {
  return null;
}

export function ExpoUIActionContent(_props: ExpoUIActionContentProps) {
  return null;
}

export function ExpoUIPaneStack(_props: ExpoUIPaneStackProps) {
  return null;
}
