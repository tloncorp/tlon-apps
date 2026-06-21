// Web entry: expo-media-library is native-only here. Its SDK 56 default ("Next")
// has no web build, and the legacy module is dead weight on web — every call site
// in MediaViewerScreen is behind `if (isWeb) return` (web saves via download), so
// these stubs are never invoked. They exist only so the namespace import resolves
// without pulling expo-media-library into the web bundle.
export async function requestPermissionsAsync(): Promise<never> {
  throw new Error('expo-media-library is not available on web');
}

export async function saveToLibraryAsync(_localUri?: string): Promise<void> {
  throw new Error('expo-media-library is not available on web');
}
