// Web entry: expo-media-library is native-only here. Its SDK 56 default ("Next")
// has no web build — every call site in MediaViewerScreen is behind
// `if (isWeb) return` (web saves via download), so these stubs are never invoked.
// They exist only so the import resolves without pulling expo-media-library into
// the web bundle.
export const Asset = {
  async create(_filePath: string): Promise<never> {
    throw new Error('expo-media-library is not available on web');
  },
};

export async function requestPermissionsAsync(): Promise<never> {
  throw new Error('expo-media-library is not available on web');
}
