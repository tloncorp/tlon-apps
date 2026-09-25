import type {
  ExpoSwiftUIActionContentProps,
  ExpoSwiftUIPaneStackProps,
  ExpoSwiftUISheetProps,
} from './ExpoSwiftUISheet.types';

// Desktop web does not use the native Expo UI sheet renderer.
export function ExpoSwiftUISheet(_props: ExpoSwiftUISheetProps) {
  return null;
}

export function ExpoSwiftUIActionContent(
  _props: ExpoSwiftUIActionContentProps
) {
  return null;
}

export function ExpoSwiftUIPaneStack(_props: ExpoSwiftUIPaneStackProps) {
  return null;
}
